import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import dayjs from 'dayjs';
import DashboardInterventions, { variation, formatVariation, ACTUALISATION_MS } from './DashboardInterventions';
import { getInterventionStats } from '../../services/api';

vi.mock('react-apexcharts', () => ({ default: () => null }));
vi.mock('../../services/api', () => ({ getInterventionStats: vi.fn() }));

const reponse = (stats, precedent) => ({
  stats: { total: 0, duree_totale: 0, utilisateurs_bloques: 0, serie: [], ...stats },
  precedent: { total: 0, duree_totale: 0, utilisateurs_bloques: 0, a_date: true, a_venir: false, ...precedent },
});

const afficher = () => render(<MemoryRouter><DashboardInterventions /></MemoryRouter>);

const Destination = () => <div data-testid="destination">{useLocation().search}</div>;
const afficherAvecHistorique = () => render(
  <MemoryRouter>
    <Routes>
      <Route path="/" element={<DashboardInterventions />} />
      <Route path="/HistoriqueInterventions" element={<Destination />} />
    </Routes>
  </MemoryRouter>,
);

const details = (container) => [...container.querySelectorAll('.dit-stat-detail')]
  .map(d => d.textContent.replace(/\s+/g, ' ').trim());

beforeEach(() => vi.clearAllMocks());

describe('variation', () => {
  test('calcule le pourcentage, null sans base de comparaison', () => {
    expect(variation(15, 10)).toBe(50);
    expect(variation(5, 10)).toBe(-50);
    expect(variation(0, 0)).toBe(0);
    expect(variation(3, 0)).toBeNull();
  });

  test('formatVariation : format français signé', () => {
    expect(formatVariation(50)).toBe('+50,0 %');
    expect(formatVariation(-12.345)).toBe('-12,3 %');
    expect(formatVariation(0)).toBe('0,0 %');
  });
});

describe('DashboardInterventions', () => {
  test('affiche nombre, durée totale et utilisateurs bloqués comparés au mois précédent à date', async () => {
    getInterventionStats.mockResolvedValue(reponse(
      { total: 12, duree_totale: 450, avec_duree: 10, utilisateurs_bloques: 2, interventions_bloquantes: 3, temps_bloque: 95, depuis_tickets: 5 },
      { total: 8, duree_totale: 300, utilisateurs_bloques: 4 },
    ));
    const { container } = afficher();

    expect(await screen.findByText('12')).toBeTruthy();
    expect(screen.getByText('07:30')).toBeTruthy();
    expect(screen.getByText('05:00')).toBeTruthy();
    expect(screen.getAllByText('+50,0 %')).toHaveLength(2);
    expect(screen.getByText('-50,0 %').className).toMatch(/positive/);
    expect(screen.getAllByText(/Mois préc\. \(à date\)/)).toHaveLength(3);
    // Utilisateurs distincts, pas interventions
    expect(screen.getByText('utilisateurs')).toBeTruthy();
    // Moyenne sur les 10 durées renseignées (450 / 10), durées manquantes signalées
    expect(details(container)).toEqual([
      'dont 5 depuis un ticket (42 %)',
      'moyenne 00:45 · 2 sans durée (17 %)',
      '3 interventions · 01:35 de blocage',
    ]);
    expect(getInterventionStats).toHaveBeenCalledWith({ periode: 'mois', date: dayjs().format('YYYY-MM') });
  });

  test('change de période et recule d\'une période', async () => {
    getInterventionStats.mockResolvedValue(reponse({}, { a_date: false }));
    afficher();
    await screen.findByText(/Aucune intervention/);

    fireEvent.click(screen.getByRole('button', { name: 'Année' }));
    await waitFor(() => expect(getInterventionStats).toHaveBeenLastCalledWith({ periode: 'annee', date: dayjs().format('YYYY') }));

    fireEvent.click(screen.getByRole('button', { name: 'Période précédente' }));
    await waitFor(() => expect(getInterventionStats).toHaveBeenLastCalledWith({ periode: 'annee', date: String(dayjs().year() - 1) }));
  });

  test('affiche le temps par technicien', async () => {
    getInterventionStats.mockResolvedValue(reponse({
      total: 4, duree_totale: 240, depuis_tickets: 3, materiels_concernes: 2,
      par_type: { DEPANNAGE: 3, INSTALLATION: 1 },
      par_technicien: [
        { id_technicien: 1, nom: 'Alice Martin', total: 3, duree: 180 },
        { id_technicien: null, nom: 'Non renseigné', total: 1, duree: 60 },
      ],
    }));
    afficher();

    expect(await screen.findByText('Répartition par type')).toBeTruthy();
    expect(screen.getByText('Alice Martin')).toBeTruthy();
    expect(screen.getByText('03:00')).toBeTruthy();
    expect(screen.getByText('Non renseigné')).toBeTruthy();
    expect(screen.queryByText('Origine des interventions')).toBeNull();
  });

  test('récurrences : matériels et utilisateurs, clic vers l\'historique filtré', async () => {
    getInterventionStats.mockResolvedValue(reponse({
      total: 5, duree_totale: 120, materiels_concernes: 3,
      recurrences: {
        materiels: [{ id: 42, total: 3, duree: 90, bloquees: 2, libelle: 'PC-COMPTA-07', detail: 'Alice Martin' }],
        utilisateurs: [],
      },
    }));
    afficherAvecHistorique();

    expect(await screen.findByText('Récurrences')).toBeTruthy();
    expect(screen.getByText('PC-COMPTA-07')).toBeTruthy();
    expect(screen.getByText(/sur 3 matériels ayant eu une intervention/)).toBeTruthy();
    expect(screen.getByLabelText('2 bloquantes')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Utilisateurs' }));
    expect(screen.getByText('Aucun utilisateur avec plusieurs interventions')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Matériels' }));
    fireEvent.click(screen.getByTitle('Voir les interventions de PC-COMPTA-07'));
    expect(screen.getByTestId('destination').textContent)
      .toBe(`?debut=${dayjs().startOf('month').format('YYYY-MM-DD')}&fin=${dayjs().endOf('month').format('YYYY-MM-DD')}&materiel=42`);
  });

  test('sous-types de Dépannage et Installation, clic vers l\'historique filtré', async () => {
    getInterventionStats.mockResolvedValue(reponse({
      total: 6, duree_totale: 120,
      par_type: { DEPANNAGE: 5, INSTALLATION: 0, PREVENTIF: 1 },
      par_sous_type: {
        DEPANNAGE: { MESSAGERIE: 1, RESEAU_CONNEXION: 3, NON_PRECISE: 1 },
        INSTALLATION: { NON_PRECISE: 0 },
      },
    }));
    const { container } = afficherAvecHistorique();

    expect(await screen.findByText('Dépannage par sous-type')).toBeTruthy();
    expect(screen.getByText('Aucune intervention installation')).toBeTruthy();
    // Plus fréquents d'abord, « Non précisé » en dernier
    const panneau = screen.getByText('Dépannage par sous-type').closest('.dit-panel');
    expect([...panneau.querySelectorAll('.dit-rec-nom')].map(n => n.textContent))
      .toEqual(['Réseau / Connexion', 'Messagerie', 'Non précisé']);
    expect(container.textContent).toMatch(/60 %/);

    fireEvent.click(screen.getByTitle('Voir les interventions Dépannage · Réseau / Connexion'));
    expect(screen.getByTestId('destination').textContent)
      .toBe(`?debut=${dayjs().startOf('month').format('YYYY-MM-DD')}&fin=${dayjs().endOf('month').format('YYYY-MM-DD')}&type=DEPANNAGE&sous_type=RESEAU_CONNEXION`);
  });

  test('affiche cumul, bloqués, heures de pointe et durée moyenne par type', async () => {
    getInterventionStats.mockResolvedValue(reponse({
      total: 3, duree_totale: 90, utilisateurs_bloques: 0,
      serie: [{ index: 0, total: 3, duree: 90, bloquees: 0 }],
      par_jour_heure: Array.from({ length: 7 }, () => Array(24).fill(0)),
      duree_moyenne_par_type: { INSTALLATION: 75, DEPANNAGE: 20, PREVENTIF: null },
    }, { serie: [] }));
    afficher();

    expect(await screen.findByText('Cumul comparé au mois précédent')).toBeTruthy();
    expect(screen.getByText('Aucune intervention bloquante sur la période')).toBeTruthy();
    expect(screen.getByText('Heures de pointe')).toBeTruthy();
    expect(screen.getByText('01:15')).toBeTruthy();
    expect(screen.getByText('00:20')).toBeTruthy();
    expect(screen.queryByText('Préventif')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Jour' }));
    await waitFor(() => expect(screen.getByText('Cumul comparé à la veille')).toBeTruthy());
    expect(screen.queryByText('Heures de pointe')).toBeNull();
  });

  test('pendant le chargement d\'une autre période, les données restent libellées selon leur période', async () => {
    getInterventionStats.mockResolvedValueOnce(reponse({ total: 2 }, { total: 1 }));
    let resoudre;
    getInterventionStats.mockReturnValueOnce(new Promise(r => { resoudre = r; }));
    afficher();
    expect((await screen.findAllByText(/Mois préc\./)).length).toBe(3);

    fireEvent.click(screen.getByRole('button', { name: 'Année' }));
    // Réponse annuelle pas encore reçue : les cartes du mois gardent leur libellé
    expect(screen.getAllByText(/Mois préc\./)).toHaveLength(3);
    expect(screen.queryByText(/Année préc\./)).toBeNull();
    expect(screen.getByText(/comparée au mois précédent à la même date/)).toBeTruthy();

    resoudre(reponse({ total: 30 }, { total: 20, a_date: true }));
    expect((await screen.findAllByText(/Année préc\. \(à date\)/)).length).toBe(3);
    expect(screen.getByText(/comparée à l'année précédente à la même date/)).toBeTruthy();
  });

  test('« Période suivante » désactivé sur la période en cours, actif sur une période passée', async () => {
    getInterventionStats.mockResolvedValue(reponse({}));
    afficher();
    await screen.findByText(/Aucune intervention/);
    const suivante = screen.getByRole('button', { name: 'Période suivante' });
    expect(suivante.disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Période précédente' }));
    expect(suivante.disabled).toBe(false);
  });

  test('« Voir le détail » ouvre l\'historique sur la plage de la période affichée', async () => {
    getInterventionStats.mockResolvedValue(reponse({}));
    afficherAvecHistorique();
    await screen.findByText(/Aucune intervention/);

    fireEvent.click(screen.getByRole('button', { name: 'Année' }));
    fireEvent.click(screen.getByRole('button', { name: 'Période précédente' }));
    fireEvent.click(screen.getByRole('button', { name: /Voir le détail/ }));
    const an = dayjs().year() - 1;
    expect(screen.getByTestId('destination').textContent).toBe(`?debut=${an}-01-01&fin=${an}-12-31`);
  });

  test('technicien et interventions bloquantes : clic vers l\'historique filtré', async () => {
    getInterventionStats.mockResolvedValue(reponse({
      total: 4, duree_totale: 240, utilisateurs_bloques: 1, interventions_bloquantes: 2, temps_bloque: 30,
      par_technicien: [
        { id_technicien: 7, nom: 'Alice Martin', total: 3, duree: 180 },
        { id_technicien: null, nom: 'Non renseigné', total: 1, duree: 60 },
      ],
    }));
    afficherAvecHistorique();
    const mois = `debut=${dayjs().startOf('month').format('YYYY-MM-DD')}&fin=${dayjs().endOf('month').format('YYYY-MM-DD')}`;

    expect((await screen.findByTitle('Voir les interventions de Non renseigné')).disabled).toBe(true);
    fireEvent.click(screen.getByTitle('Voir les interventions de Alice Martin'));
    expect(screen.getByTestId('destination').textContent).toBe(`?${mois}&technicien=7`);
  });

  test('carte « Utilisateurs bloqués » : lien vers les interventions bloquantes', async () => {
    getInterventionStats.mockResolvedValue(reponse({ total: 2, utilisateurs_bloques: 1, interventions_bloquantes: 1, temps_bloque: 30 }));
    afficherAvecHistorique();
    fireEvent.click(await screen.findByRole('button', { name: /Voir les interventions bloquantes/ }));
    expect(screen.getByTestId('destination').textContent).toMatch(/&bloque=1$/);
  });

  test('erreur au premier chargement : « Réessayer » relance la requête', async () => {
    getInterventionStats.mockRejectedValueOnce(new Error('Serveur indisponible'));
    getInterventionStats.mockResolvedValueOnce(reponse({ total: 3 }));
    afficher();

    expect(await screen.findByText('Erreur : Serveur indisponible')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Réessayer/ }));
    expect(await screen.findByText('3')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(getInterventionStats).toHaveBeenCalledTimes(2);
  });

  test('erreur sur une autre période : les données précédentes restent affichées avec un bandeau', async () => {
    getInterventionStats.mockResolvedValueOnce(reponse({ total: 9 }));
    getInterventionStats.mockRejectedValueOnce(new Error('Délai dépassé'));
    afficher();
    expect(await screen.findByText('9')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Année' }));
    const bandeau = await screen.findByRole('alert');
    expect(bandeau.textContent).toMatch(/Délai dépassé · données affichées : .+ \d{4}/);
    expect(screen.getByText('9')).toBeTruthy();
  });

  test('période en cours : actualisation automatique, sans griser le tableau', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    try {
      getInterventionStats.mockResolvedValue(reponse({ total: 1 }));
      const { container } = afficher();
      await screen.findByText('1');
      expect(getInterventionStats).toHaveBeenCalledTimes(1);

      getInterventionStats.mockResolvedValue(reponse({ total: 5 }));
      act(() => { vi.advanceTimersByTime(ACTUALISATION_MS); });
      expect(container.querySelector('.dit-body.is-refreshing')).toBeNull();
      expect(await screen.findByText('5')).toBeTruthy();
      expect(getInterventionStats).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  test('période passée : pas d\'actualisation automatique', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    try {
      getInterventionStats.mockResolvedValue(reponse({}));
      afficher();
      await screen.findByText(/Aucune intervention/);
      fireEvent.click(screen.getByRole('button', { name: 'Période précédente' }));
      await waitFor(() => expect(getInterventionStats).toHaveBeenCalledTimes(2));

      act(() => { vi.advanceTimersByTime(ACTUALISATION_MS * 2); });
      expect(getInterventionStats).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  test('sans intervention, les panneaux secondaires ne sont pas affichés', async () => {
    getInterventionStats.mockResolvedValue(reponse({}));
    afficher();
    await screen.findByText(/Aucune intervention/);
    expect(screen.queryByText('Répartition par type')).toBeNull();
  });

  test('période à venir : pas de variation calculée', async () => {
    getInterventionStats.mockResolvedValue(reponse({}, { total: 5, a_venir: true, a_date: false }));
    afficher();
    expect((await screen.findAllByText('N/A'))).toHaveLength(3);
  });
});

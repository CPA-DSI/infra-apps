import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import dayjs from 'dayjs';
import DashboardInterventions, { variation } from './DashboardInterventions';
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
    expect(screen.getAllByText('+50.0%')).toHaveLength(2);
    expect(screen.getByText('-50.0%').className).toMatch(/positive/);
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
    expect(screen.getByText(/3 matériels concernés au total/)).toBeTruthy();
    expect(screen.getByLabelText('2 bloquantes')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Utilisateurs' }));
    expect(screen.getByText('Aucun utilisateur avec plusieurs interventions')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Matériels' }));
    fireEvent.click(screen.getByTitle('Voir les interventions de PC-COMPTA-07'));
    expect(screen.getByTestId('destination').textContent)
      .toBe(`?periode=mois&date=${dayjs().format('YYYY-MM-DD')}&materiel=42`);
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

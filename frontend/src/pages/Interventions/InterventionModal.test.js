import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import InterventionModal from './InterventionModal';
import { createIntervention, updateIntervention } from '../../services/api';

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { role: 'IT_ADMIN', id_n: 1 } }) }));
vi.mock('../../services/api', () => ({
  fetchMateriels: vi.fn(() => Promise.resolve([])),
  fetchLocaux: vi.fn(() => Promise.resolve([])),
  getTickets: vi.fn(() => Promise.resolve([
    { idTicket: 5, numeroTicket: 'T-5', titre: 'Imprimante', statut: 'EN_COURS' },
    { idTicket: 6, numeroTicket: 'T-6', titre: 'VPN', statut: 'RESOLU' },
  ])),
  createIntervention: vi.fn((data) => Promise.resolve({ id_intervention: 1, ...data })),
  updateIntervention: vi.fn((id, data) => Promise.resolve({ id_intervention: id, ...data })),
}));

const ouvrir = (props = {}) => {
  const onSaved = vi.fn();
  render(<InterventionModal show onClose={() => {}} onSaved={onSaved} {...props} />);
  return onSaved;
};

const saisirDescription = () =>
  fireEvent.change(screen.getByLabelText(/Description/), { target: { value: 'Passage au poste' } });

const champType = () => screen.getByRole('button', { name: /^Type/ });

// Liste unique Type + Sous-type : ouvre la liste et clique l'option (libellé exact en début de nom)
const choisirType = (libelle) => {
  fireEvent.click(champType());
  fireEvent.click(screen.getByRole('option', { name: new RegExp(`^${libelle}`) }));
};

const enregistrer = () => fireEvent.submit(screen.getByRole('button', { name: 'Enregistrer' }).closest('form'));

beforeEach(() => vi.clearAllMocks());

describe('InterventionModal : solution partagée avec le ticket', () => {
  test('propose de clôturer un ticket ouvert et envoie la clôture', async () => {
    const onSaved = ouvrir({ prefill: { id_ticket: '5' } });
    const caseCloture = await screen.findByLabelText(/Clôturer le ticket T-5/);
    saisirDescription();
    choisirType('Imprimante / Scanner');
    fireEvent.click(caseCloture);

    // Solution obligatoire quand on clôture
    fireEvent.submit(screen.getByRole('button', { name: 'Enregistrer' }).closest('form'));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(createIntervention).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/Solution/), { target: { value: 'Pilote réinstallé' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Enregistrer' }).closest('form'));
    await waitFor(() => expect(createIntervention).toHaveBeenCalled());
    expect(createIntervention.mock.calls[0][0]).toMatchObject({
      id_ticket: '5', solution: 'Pilote réinstallé', cloturer_ticket: true, sous_type: 'IMPRIMANTE_SCANNER',
    });
    expect(onSaved.mock.calls[0][1]).toEqual({ ticketCloture: true });
  });

  test('ne propose pas la clôture pour un ticket déjà résolu', async () => {
    ouvrir({ prefill: { id_ticket: '6' } });
    await waitFor(() => expect(screen.getByLabelText(/Solution/)).toBeTruthy());
    await new Promise(r => setTimeout(r, 0));
    expect(screen.queryByLabelText(/Clôturer le ticket/)).toBeNull();
  });

  test('intervention de clôture : ticket figé et solution obligatoire', async () => {
    const intervention = {
      id_intervention: 9, date_intervention: '2026-11-26T09:30:00', type: 'DEPANNAGE', description: 'Imprimante',
      solution: 'Pilote', duree_minutes: 30, id_ticket: 6, cloture_ticket: true, nom_technicien: '1 - Moi',
      ticket: { idTicket: 6, numeroTicket: 'T-6' },
    };
    ouvrir({ intervention });
    expect(screen.getByText(/Cette intervention a clôturé le ticket T-6/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Solution/), { target: { value: '' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Enregistrer' }).closest('form'));
    expect((await screen.findByRole('alert')).textContent).toMatch(/partagée avec le ticket/);
    expect(updateIntervention).not.toHaveBeenCalled();
  });
});

describe('InterventionModal : liste unique Type + Sous-type', () => {
  test('type obligatoire ; un choix renseigne type et sous-type, exemples affichés', async () => {
    ouvrir();
    saisirDescription();
    expect(champType().textContent).toMatch(/Choisir un type/);
    enregistrer();
    expect((await screen.findByRole('alert')).textContent).toMatch(/type est obligatoire/);
    expect(createIntervention).not.toHaveBeenCalled();

    choisirType('Réseau / Connexion');
    expect(champType().textContent).toMatch(/Dépannage\s*Réseau \/ Connexion/);
    expect(screen.getByText(/Pas d'internet, câble, Wi-Fi/)).toBeTruthy();
    enregistrer();
    await waitFor(() => expect(createIntervention).toHaveBeenCalled());
    expect(createIntervention.mock.calls[0][0]).toMatchObject({ type: 'DEPANNAGE', sous_type: 'RESEAU_CONNEXION' });
  });

  test('liste groupée ; la recherche porte sur les exemples, sans accents', () => {
    ouvrir();
    fireEvent.click(champType());
    expect(screen.getByText('Autres types')).toBeTruthy();
    expect(screen.getAllByRole('option')).toHaveLength(20);

    fireEvent.change(screen.getByPlaceholderText(/Rechercher/), { target: { value: 'wifi' } });
    // Ni accents ni tirets : « wifi » trouve « Wi-Fi »
    expect(screen.getAllByRole('option').map(o => o.firstChild.textContent)).toEqual(['Réseau / Connexion', 'Réseau']);
    fireEvent.change(screen.getByPlaceholderText(/Rechercher/), { target: { value: 'outlook' } });
    expect(screen.getAllByRole('option').map(o => o.firstChild.textContent)).toEqual(['Bureautique']);
    fireEvent.change(screen.getByPlaceholderText(/Rechercher/), { target: { value: 'reseau' } });
    expect(screen.getAllByRole('option').map(o => o.firstChild.textContent))
      .toEqual(['Réseau / Connexion', 'Serveur / Partage', 'Réseau']);
  });

  test('type sans sous-type : choix direct', async () => {
    ouvrir();
    choisirType('Préventif');
    expect(screen.queryByText(/Exemples/)).toBeNull();
    saisirDescription();
    enregistrer();
    await waitFor(() => expect(createIntervention).toHaveBeenCalled());
    expect(createIntervention.mock.calls[0][0]).toMatchObject({ type: 'PREVENTIF', sous_type: null });
  });

  test('modification : reprend le choix ; sans sous-type enregistré, demande de le préciser', async () => {
    const base = { id_intervention: 3, date_intervention: '2026-11-26T09:30:00', description: 'Office', nom_technicien: '1 - Moi' };
    const { unmount } = render(<InterventionModal show onClose={() => {}} onSaved={vi.fn()}
      intervention={{ ...base, type: 'INSTALLATION', sous_type: 'LOGICIEL' }} />);
    expect(champType().textContent).toMatch(/Installation\s*Installation logiciel/);
    unmount();

    ouvrir({ intervention: { ...base, type: 'DEPANNAGE', sous_type: null } });
    expect(champType().textContent).toMatch(/Dépannage · précisez le sous-type/);
    enregistrer();
    expect((await screen.findByRole('alert')).textContent).toMatch(/Précisez le sous-type/);
    expect(updateIntervention).not.toHaveBeenCalled();
  });
});

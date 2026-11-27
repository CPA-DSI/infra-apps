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

beforeEach(() => vi.clearAllMocks());

describe('InterventionModal : solution partagée avec le ticket', () => {
  test('propose de clôturer un ticket ouvert et envoie la clôture', async () => {
    const onSaved = ouvrir({ prefill: { id_ticket: '5' } });
    const caseCloture = await screen.findByLabelText(/Clôturer le ticket T-5/);
    saisirDescription();
    fireEvent.click(caseCloture);

    // Solution obligatoire quand on clôture
    fireEvent.submit(screen.getByRole('button', { name: 'Enregistrer' }).closest('form'));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(createIntervention).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/Solution/), { target: { value: 'Pilote réinstallé' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Enregistrer' }).closest('form'));
    await waitFor(() => expect(createIntervention).toHaveBeenCalled());
    expect(createIntervention.mock.calls[0][0]).toMatchObject({ id_ticket: '5', solution: 'Pilote réinstallé', cloturer_ticket: true });
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

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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
      { total: 12, duree_totale: 450, utilisateurs_bloques: 2 },
      { total: 8, duree_totale: 300, utilisateurs_bloques: 4 },
    ));
    afficher();

    expect(await screen.findByText('12')).toBeTruthy();
    expect(screen.getByText('07:30')).toBeTruthy();
    expect(screen.getByText('05:00')).toBeTruthy();
    expect(screen.getAllByText('+50.0%')).toHaveLength(2);
    expect(screen.getByText('-50.0%').className).toMatch(/positive/);
    expect(screen.getAllByText(/Mois préc\. \(à date\)/)).toHaveLength(3);
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

  test('période à venir : pas de variation calculée', async () => {
    getInterventionStats.mockResolvedValue(reponse({}, { total: 5, a_venir: true, a_date: false }));
    afficher();
    expect((await screen.findAllByText('N/A'))).toHaveLength(3);
  });
});

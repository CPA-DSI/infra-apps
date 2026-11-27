import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DateRangeFilter, { EMPTY_RANGE, matchesDateRange, isRangeActive } from './DateRangeFilter';

describe('matchesDateRange', () => {
    const range = { key: 'custom', debut: '2022-04-01', fin: '2022-05-31' };

    it('accepte tout quand aucune période', () => {
        expect(matchesDateRange('2020-01-01', EMPTY_RANGE)).toBe(true);
        expect(matchesDateRange(null, EMPTY_RANGE)).toBe(true);
        expect(isRangeActive(EMPTY_RANGE)).toBe(false);
    });

    it('inclut les bornes', () => {
        expect(matchesDateRange('2022-04-01T00:00:00', range)).toBe(true);
        expect(matchesDateRange('2022-05-31T23:00:00', range)).toBe(true);
        expect(matchesDateRange('2022-03-31', range)).toBe(false);
        expect(matchesDateRange('2022-06-01', range)).toBe(false);
        expect(matchesDateRange(null, range)).toBe(false);
    });

    it('gère les bornes ouvertes', () => {
        expect(matchesDateRange('2030-01-01', { key: 'custom', debut: '2022-04-01', fin: '' })).toBe(true);
        expect(matchesDateRange('2000-01-01', { key: 'custom', debut: '', fin: '2022-05-31' })).toBe(true);
    });

    it('« Sans date » ne garde que les dates vides', () => {
        const none = { key: 'none', debut: '', fin: '' };
        expect(matchesDateRange(null, none)).toBe(true);
        expect(matchesDateRange('2022-04-01', none)).toBe(false);
    });
});

describe('DateRangeFilter', () => {
    it('applique un raccourci année', () => {
        let applied = null;
        render(<DateRangeFilter value={EMPTY_RANGE} onChange={(r) => { applied = r; }} years={[2022]} />);
        fireEvent.click(screen.getByRole('button', { name: 'Filtrer par période' }));
        fireEvent.click(screen.getByRole('button', { name: '2022' }));
        fireEvent.click(screen.getByText('Appliquer'));
        expect(applied).toEqual({ key: 'year:2022', debut: '2022-01-01', fin: '2022-12-31' });
    });

    it('sélectionne une plage dans le calendrier', () => {
        let applied = null;
        const value = { key: 'custom', debut: '2022-05-01', fin: '' };
        render(<DateRangeFilter value={value} onChange={(r) => { applied = r; }} />);
        fireEvent.click(screen.getByRole('button', { name: 'Filtrer par période' }));
        const day = (n) => screen.getAllByRole('button').find(b => b.closest('.rdp-day') && b.textContent === String(n) && !b.closest('.rdp-outside'));
        fireEvent.click(day(31));
        fireEvent.click(screen.getByText('Appliquer'));
        expect(applied).toEqual({ key: 'custom', debut: '2022-05-01', fin: '2022-05-31' });
    });

    it("Annuler n'applique rien", () => {
        let called = false;
        render(<DateRangeFilter value={EMPTY_RANGE} onChange={() => { called = true; }} />);
        fireEvent.click(screen.getByRole('button', { name: 'Filtrer par période' }));
        fireEvent.click(screen.getByText('Cette année'));
        fireEvent.click(screen.getByText('Annuler'));
        expect(called).toBe(false);
    });
});

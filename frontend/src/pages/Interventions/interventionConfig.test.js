import { describe, it, expect } from 'vitest';
import dayjs from 'dayjs';
import { plageDepuisUrl, decalerPlage, libellePlage, cleRaccourci, libellePoint } from './interventionConfig';

const params = (o) => new URLSearchParams(o);

describe('plageDepuisUrl', () => {
  it('lit une plage libre ?debut=&fin=', () => {
    expect(plageDepuisUrl(params({ debut: '2026-10-10', fin: '2026-10-24' }))).toMatchObject({ debut: '2026-10-10', fin: '2026-10-24', key: 'custom' });
  });

  it('une seule borne vaut pour un jour, bornes inversées remises dans l\'ordre', () => {
    expect(plageDepuisUrl(params({ debut: '2026-10-10' }))).toMatchObject({ debut: '2026-10-10', fin: '2026-10-10' });
    expect(plageDepuisUrl(params({ debut: '2026-10-24', fin: '2026-10-10' }))).toMatchObject({ debut: '2026-10-10', fin: '2026-10-24' });
  });

  it('convertit l\'ancien format des liens du tableau de bord', () => {
    expect(plageDepuisUrl(params({ periode: 'mois', date: '2026-11-05' }))).toMatchObject({ debut: '2026-11-01', fin: '2026-11-30' });
    expect(plageDepuisUrl(params({ periode: 'jour', date: '2026-11-05' }))).toMatchObject({ debut: '2026-11-05', fin: '2026-11-05' });
    expect(plageDepuisUrl(params({ periode: 'annee', date: '2025' }))).toMatchObject({ debut: '2025-01-01', fin: '2025-12-31' });
  });

  it('par défaut : le mois en cours, reconnu comme raccourci « Ce mois »', () => {
    const r = plageDepuisUrl(params({}));
    expect(r).toMatchObject({ debut: dayjs().startOf('month').format('YYYY-MM-DD'), key: 'this-month' });
  });

  it('ignore une date invalide', () => {
    expect(plageDepuisUrl(params({ debut: '2026-02-30', fin: 'abc' })).key).toBe('this-month');
  });
});

describe('decalerPlage', () => {
  it('mois entiers : décale d\'autant de mois', () => {
    expect(decalerPlage({ debut: '2026-03-01', fin: '2026-03-31' }, -1)).toMatchObject({ debut: '2026-02-01', fin: '2026-02-28' });
    expect(decalerPlage({ debut: '2026-10-01', fin: '2026-12-31' }, 1)).toMatchObject({ debut: '2027-01-01', fin: '2027-03-31' });
    expect(decalerPlage({ debut: '2026-01-01', fin: '2026-12-31' }, -1)).toMatchObject({ debut: '2025-01-01', fin: '2025-12-31' });
  });

  it('autres plages : décale de leur nombre de jours', () => {
    expect(decalerPlage({ debut: '2026-11-26', fin: '2026-11-26' }, -1)).toMatchObject({ debut: '2026-11-25', fin: '2026-11-25' });
    expect(decalerPlage({ debut: '2026-11-23', fin: '2026-11-29' }, 1)).toMatchObject({ debut: '2026-11-30', fin: '2026-12-06' });
    expect(decalerPlage({ debut: '2026-10-10', fin: '2026-10-24' }, -1)).toMatchObject({ debut: '2026-09-25', fin: '2026-10-09' });
  });
});

describe('libellePlage', () => {
  it('jour, mois, trimestre, année, plage libre', () => {
    expect(libellePlage({ debut: '2026-11-26', fin: '2026-11-26' })).toBe('jeudi 26 novembre 2026');
    expect(libellePlage({ debut: '2026-11-01', fin: '2026-11-30' })).toBe('novembre 2026');
    expect(libellePlage({ debut: '2026-10-01', fin: '2026-12-31' })).toBe('4e trimestre 2026');
    expect(libellePlage({ debut: '2026-01-01', fin: '2026-03-31' })).toBe('1er trimestre 2026');
    expect(libellePlage({ debut: '2026-01-01', fin: '2026-12-31' })).toBe('2026');
    expect(libellePlage({ debut: '2026-10-10', fin: '2026-10-24' })).toBe('10/10/2026 – 24/10/2026');
  });
});

describe('cleRaccourci', () => {
  const t = dayjs('2026-11-27'); // vendredi
  it('reconnaît les raccourcis', () => {
    expect(cleRaccourci('2026-11-27', '2026-11-27', t)).toBe('today');
    expect(cleRaccourci('2026-11-23', '2026-11-29', t)).toBe('this-week');
    expect(cleRaccourci('2026-10-01', '2026-10-31', t)).toBe('last-month');
    expect(cleRaccourci('2026-10-01', '2026-12-31', t)).toBe('this-quarter');
    expect(cleRaccourci('2026-10-10', '2026-10-24', t)).toBe('custom');
  });
});

describe('libellePoint', () => {
  it('libellés de l\'axe selon le découpage', () => {
    expect(libellePoint('heure', { index: 9 }, {})).toBe('9h');
    expect(libellePoint('jour', { date: '2026-11-05' }, { debut: '2026-11-01', fin: '2026-11-30' })).toBe('5');
    expect(libellePoint('jour', { date: '2026-11-05' }, { debut: '2026-10-20', fin: '2026-11-10' })).toBe('05/11');
    expect(libellePoint('mois', { date: '2026-02-01' }, { debut: '2025-12-01', fin: '2026-11-30' })).toBe('févr. 26');
  });
});

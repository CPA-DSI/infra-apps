import { formatDuree, parseDuree, dureeVersSaisie } from './duree';

describe('formatDuree', () => {
  it('formate en hh:mm', () => {
    expect(formatDuree(0)).toBe('00:00');
    expect(formatDuree(5)).toBe('00:05');
    expect(formatDuree(75)).toBe('01:15');
    expect(formatDuree(120)).toBe('02:00');
  });
  it('dépasse 24 h pour les totaux', () => {
    expect(formatDuree(2730)).toBe('45:30');
  });
  it('traite null comme 0', () => {
    expect(formatDuree(null)).toBe('00:00');
  });
});

describe('parseDuree', () => {
  it('lit hh:mm et h:mm', () => {
    expect(parseDuree('01:30')).toBe(90);
    expect(parseDuree('1:05')).toBe(65);
    expect(parseDuree('168:00')).toBe(10080);
  });
  it('lit la notation 1h30 / 2h', () => {
    expect(parseDuree('1h30')).toBe(90);
    expect(parseDuree('2h')).toBe(120);
  });
  it('renvoie null pour une saisie vide', () => {
    expect(parseDuree('')).toBeNull();
    expect(parseDuree('  ')).toBeNull();
    expect(parseDuree(undefined)).toBeNull();
  });
  it('renvoie NaN pour une saisie invalide', () => {
    expect(parseDuree('1:75')).toBeNaN();
    expect(parseDuree('1:5')).toBeNaN();
    expect(parseDuree('1:')).toBeNaN();
    expect(parseDuree('90')).toBeNaN();
    expect(parseDuree('abc')).toBeNaN();
  });
});

describe('saisie', () => {
  it('dureeVersSaisie', () => {
    expect(dureeVersSaisie(null)).toBe('');
    expect(dureeVersSaisie(45)).toBe('00:45');
  });
});

import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import DureePicker from './DureePicker';

const Harnais = ({ initial = '', onChange = () => {} }) => {
  const [v, setV] = useState(initial);
  return <DureePicker id="t" value={v} onChange={(x) => { setV(x); onChange(x); }} />;
};

const option = (liste, texte) =>
  [...screen.getByRole('listbox', { name: liste }).querySelectorAll('[role="option"]')].find(o => o.textContent === texte);

describe('DureePicker', () => {
  test('affiche le placeholder puis la valeur choisie', () => {
    const onChange = vi.fn();
    render(<Harnais onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /hh:mm/ }));
    fireEvent.click(option('Heures', '01'));
    fireEvent.click(option('Minutes', '30'));
    fireEvent.click(screen.getByRole('button', { name: /Valider/ }));
    expect(onChange).toHaveBeenCalledWith('01:30');
    expect(screen.getByRole('button', { name: /01:30/ })).toBeTruthy();
  });

  test('reprend la valeur existante à l\'ouverture', () => {
    render(<Harnais initial="02:15" />);
    fireEvent.click(screen.getByRole('button', { name: /02:15/ }));
    expect(option('Heures', '02').getAttribute('aria-selected')).toBe('true');
    expect(option('Minutes', '15').getAttribute('aria-selected')).toBe('true');
  });

  test('les flèches du clavier changent la sélection', () => {
    render(<Harnais initial="00:10" />);
    fireEvent.click(screen.getByRole('button', { name: /00:10/ }));
    fireEvent.keyDown(screen.getByRole('listbox', { name: 'Minutes' }), { key: 'ArrowDown' });
    expect(screen.getByRole('button', { name: /Valider 00:11/ })).toBeTruthy();
  });

  test('Effacer vide la durée', () => {
    const onChange = vi.fn();
    render(<Harnais initial="00:45" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /00:45/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Effacer' }));
    expect(onChange).toHaveBeenCalledWith('');
  });

  test('les heures vont jusqu\'au maximum (168 h par défaut)', () => {
    render(<Harnais />);
    fireEvent.click(screen.getByRole('button', { name: /hh:mm/ }));
    expect(option('Heures', '168')).toBeDefined();
    expect(option('Heures', '169')).toBeUndefined();
  });
});

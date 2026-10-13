// jest-dom ajoute des matchers DOM (toBeInTheDocument, toHaveTextContent...) a expect de Vitest.
// https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom/vitest';

// waitFor (Testing Library) ne fait avancer les faux timers que s'il detecte un
// objet global `jest` : on expose l'API de Vitest sous ce nom pour les tests
// qui combinent vi.useFakeTimers() et waitFor().
globalThis.jest = {
  advanceTimersByTime: (ms) => vi.advanceTimersByTime(ms),
};

import { expect, it, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import FridgeDetails from './FridgeDetails';
vi.mock('../components/TemperatureChart', () => ({ default: () => <div>Chart</div> }));
afterEach(() => vi.unstubAllGlobals());
it('shows complete incident bounds and unknown-date evidence under a historical date filter', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ id: 'f', name: 'Counter', branch: { name: 'Bakery' }, readings: [],
    temperatureIncidents: [{ id: 'i', startedAt: '2040-01-01T23:45:00', endedAt: '2040-01-02T00:15:00', durationMinutes: 30, peakTemperatureCelsius: 7, details: { state: 'RECOVERED' } }],
    dataQuality: [], undatedQuality: [{ id: 'u', type: 'INVALID_READING', startedAt: null, details: { reason: 'Unrecognized timestamp', sourceRowNumber: 4 } }],
  }) })));
  render(<MemoryRouter initialEntries={['/fridges/f?from=2040-01-02']}><Routes><Route path="/fridges/:id" element={<FridgeDetails />} /></Routes></MemoryRouter>);
  expect(await screen.findByText('2040-01-01 23:45')).toBeTruthy();
  expect(screen.getByText('30 minutes')).toBeTruthy(); expect(screen.getByText('Date unknown')).toBeTruthy();
  expect(screen.getByRole('link', { name: /All fridges/ }).getAttribute('href')).toBe('/?from=2040-01-02');
});
it('keeps date controls available to recover from a rejected range', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 400, json: async () => ({ message: 'Start date must be on or before end date.' }) })));
  render(<MemoryRouter initialEntries={['/fridges/f?from=2050-01-01&to=2040-01-01']}><Routes><Route path="/fridges/:id" element={<FridgeDetails />} /></Routes></MemoryRouter>);
  await screen.findByRole('alert');
  await userEvent.click(screen.getByRole('button', { name: 'All dates' }));
  expect((screen.getByLabelText('From') as HTMLInputElement).value).toBe('');
  expect((screen.getByLabelText('To') as HTMLInputElement).value).toBe('');
});

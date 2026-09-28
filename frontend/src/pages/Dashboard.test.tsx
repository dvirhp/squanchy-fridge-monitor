import { expect, it, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import Dashboard from './Dashboard';
afterEach(() => vi.unstubAllGlobals());
function Location() { return <output data-testid="url">{useLocation().search}</output>; }
it('preserves URL dates when changing status and links to historical fridge details', async () => {
  const fetcher = vi.fn(async (path: string) => ({ ok: true, json: async () => path.includes('import-options') ? { branches: [], loggers: [] } : {
    counts: { total: 1, temperature: 1, quality: 1, clear: 0, noData: 0 }, fridges: [{ id: 'f', name: 'Cabinet', branch: { id: 'b', name: 'Branch' },
      status: 'temperature', temperatureCount: 1, qualityCount: 1, undatedCount: 1, latestReading: null }],
  } })); vi.stubGlobal('fetch', fetcher);
  render(<MemoryRouter initialEntries={['/?from=2040-01-01']}><Dashboard /><Location /></MemoryRouter>);
  const link = await screen.findByRole('link', { name: /Cabinet/ });
  expect(link.getAttribute('href')).toBe('/fridges/f?from=2040-01-01');
  expect(screen.getByText('Temperature issue')).toBeTruthy(); expect(screen.getByText('Data-quality issue')).toBeTruthy();
  await userEvent.selectOptions(screen.getByLabelText('Status'), 'quality');
  await waitFor(() => expect(screen.getByTestId('url').textContent).toContain('from=2040-01-01&status=quality'));
});
it('offers retry after a network failure and then shows the empty state', async () => {
  let failed = true;
  vi.stubGlobal('fetch', vi.fn(async (path: string) => {
    if (path.includes('dashboard') && failed) throw new Error('offline');
    return { ok: true, json: async () => path.includes('import-options') ? { branches: [], loggers: [] } : { counts: { total: 0 }, fridges: [] } };
  }));
  render(<MemoryRouter><Dashboard /></MemoryRouter>);
  expect(await screen.findByRole('alert')).toBeTruthy(); failed = false;
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText('No fridges match')).toBeTruthy();
});

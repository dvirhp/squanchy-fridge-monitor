import { expect, it, vi, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Upload from './Upload';
afterEach(() => vi.unstubAllGlobals());
it('requires explicit new logger context, retains fields on error, and submits a deliberate move', async () => {
  const fetcher = vi.fn(async (_path: string, init?: RequestInit) => init?.method === 'POST'
    ? { ok: false, status: 409, json: async () => ({ message: 'The start time overlaps stored readings.' }) }
    : { ok: true, json: async () => ({ branches: [{ id: 'b', name: 'Bakery', fridges: [{ id: 'f', name: 'Counter' }] }],
      loggers: [{ id: 'l', externalId: 'L-NEW', temperatureUnit: 'CELSIUS', expectedIntervalMinutes: 15, assignments: [] }] }) });
  vi.stubGlobal('fetch', fetcher);
  // jsdom's native form/file integration does not see user-event's FileList.
  const NativeFormData = window.FormData;
  vi.stubGlobal('FormData', class extends NativeFormData {
    constructor(form?: HTMLFormElement) {
      super(form);
      const file = (form?.elements.namedItem('file') as HTMLInputElement | null)?.files?.[0];
      if (file) this.set('file', file);
    }
  });
  render(<MemoryRouter><Upload /></MemoryRouter>);
  await screen.findByLabelText('Logger');
  await userEvent.selectOptions(screen.getByLabelText('Logger'), 'new');
  expect((screen.getByLabelText('File temperature unit') as HTMLSelectElement).required).toBe(true);
  expect((screen.getByLabelText('File temperature unit') as HTMLSelectElement).value).toBe('');
  expect(screen.getByLabelText('Logger started here')).toBeTruthy();
  await userEvent.selectOptions(screen.getByLabelText('Logger'), 'l');
  await userEvent.selectOptions(screen.getByLabelText('Branch'), 'b');
  await userEvent.selectOptions(screen.getByLabelText('Fridge'), 'f');
  await userEvent.selectOptions(screen.getByLabelText('Logger placement'), 'move');
  fireEvent.change(screen.getByLabelText('Logger started here'), { target: { value: '2040-01-01T00:00' } });
  await userEvent.upload(screen.getByLabelText('Logger CSV'), new File(['Time,Temperature\n2040-01-01 06:00,4'], 'data.csv', { type: 'text/csv' }));
  fireEvent.submit(screen.getByRole('button', { name: 'Import CSV' }).closest('form')!);
  expect(await screen.findByRole('alert')).toBeTruthy();
  await waitFor(() => expect(fetcher.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(true));
  const body = fetcher.mock.calls.find(([, init]) => init?.method === 'POST')![1]!.body as FormData;
  expect(body.get('assignmentValidFrom')).toBe('2040-01-01T00:00'); expect(body.get('temperatureUnit')).toBeNull();
  expect((screen.getByLabelText('Logger CSV') as HTMLInputElement).files?.[0].name).toBe('data.csv');
});

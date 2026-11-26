import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { Link, MemoryRouter, Route, Routes } from 'react-router';

import { EventCreateDraftProvider, useEventCreateDraft } from '@/state/EventCreateDraftContext';

function CreateScreen({ onToggle }: { onToggle?: boolean }) {
  const { draft, updateDraft } = useEventCreateDraft();
  void onToggle;
  return (
    <div>
      <p data-testid="descriptor">{draft.descriptor}</p>
      <p data-testid="customer">{draft.customerId ?? 'none'}</p>
      <button type="button" onClick={() => updateDraft({ descriptor: '초안 제목' })}>
        제목 입력
      </button>
      <button type="button" onClick={() => updateDraft({ customerId: 'customer-1' })}>
        고객 선택
      </button>
      <Link to="/app/schedule">일정으로</Link>
    </div>
  );
}

function ScheduleScreen() {
  return <Link to="/app/events/new">+ 일정</Link>;
}

function App() {
  return (
    <EventCreateDraftProvider>
      <Routes>
        <Route path="/app/events/new" element={<CreateScreen />} />
        <Route path="/app/schedule" element={<ScheduleScreen />} />
      </Routes>
    </EventCreateDraftProvider>
  );
}

function Remounting() {
  const [shown, setShown] = useState(true);
  return (
    <div>
      <button type="button" onClick={() => setShown((value) => !value)}>
        토글
      </button>
      {shown ? <CreateScreen /> : null}
    </div>
  );
}

describe('event create draft and route (MAJOR-01 regression)', () => {
  it('a new create session starts empty after leaving the create route and coming back', async () => {
    render(
      <MemoryRouter initialEntries={['/app/events/new']}>
        <App />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: '고객 선택' }));
    fireEvent.click(screen.getByRole('button', { name: '제목 입력' }));
    fireEvent.click(screen.getByRole('link', { name: '일정으로' }));
    await act(async () => undefined);
    fireEvent.click(screen.getByRole('link', { name: '+ 일정' }));
    await act(async () => undefined);
    expect(screen.getByTestId('descriptor')).toHaveTextContent('');
    expect(screen.getByTestId('customer')).toHaveTextContent('none');
  });

  it('a draft with only the customer or time changed is also reset on re-entry', async () => {
    render(
      <MemoryRouter initialEntries={['/app/events/new']}>
        <App />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: '고객 선택' }));
    fireEvent.click(screen.getByRole('link', { name: '일정으로' }));
    await act(async () => undefined);
    fireEvent.click(screen.getByRole('link', { name: '+ 일정' }));
    await act(async () => undefined);
    expect(screen.getByTestId('customer')).toHaveTextContent('none');
  });

  it('keeps the draft while the create screen itself remounts on the same route (rotation or resize)', async () => {
    render(
      <MemoryRouter initialEntries={['/app/events/new']}>
        <EventCreateDraftProvider>
          <Routes>
            <Route path="/app/events/new" element={<Remounting />} />
          </Routes>
        </EventCreateDraftProvider>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: '제목 입력' }));
    fireEvent.click(screen.getByRole('button', { name: '토글' }));
    fireEvent.click(screen.getByRole('button', { name: '토글' }));
    expect(screen.getByTestId('descriptor')).toHaveTextContent('초안 제목');
  });
});

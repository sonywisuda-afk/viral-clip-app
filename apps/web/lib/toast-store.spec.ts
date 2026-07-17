import { toast, useToastStore } from './toast-store';

describe('toast-store', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] });
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('push() adds a toast with a generated id', () => {
    toast({ title: 'Upload selesai', tone: 'good' });

    const { toasts } = useToastStore.getState();
    expect(toasts).toHaveLength(1);
    expect(toasts[0]).toMatchObject({ title: 'Upload selesai', tone: 'good' });
    expect(toasts[0].id).toEqual(expect.any(String));
  });

  it('dismiss() removes only the matching toast', () => {
    useToastStore.getState().push({ title: 'A', tone: 'good' });
    useToastStore.getState().push({ title: 'B', tone: 'bad' });
    const [first, second] = useToastStore.getState().toasts;

    useToastStore.getState().dismiss(first.id);

    const { toasts } = useToastStore.getState();
    expect(toasts).toHaveLength(1);
    expect(toasts[0].id).toBe(second.id);
  });

  it('auto-dismisses a toast after the timeout', () => {
    toast({ title: 'Upload selesai', tone: 'good' });
    expect(useToastStore.getState().toasts).toHaveLength(1);

    jest.advanceTimersByTime(5000);

    expect(useToastStore.getState().toasts).toHaveLength(0);
  });
});

import { NotificationDeliveryProducer } from './notification-delivery.producer';

describe('NotificationDeliveryProducer', () => {
  it('enqueues with the configured retry options', async () => {
    const add = jest.fn().mockResolvedValue(undefined);
    const producer = new NotificationDeliveryProducer({ add } as never);

    await producer.enqueue({ notificationId: 'notif-1' });

    expect(add).toHaveBeenCalledWith(
      'notification-delivery',
      { notificationId: 'notif-1' },
      { attempts: 3, backoff: { type: 'exponential', delay: 10_000 } },
    );
  });
});

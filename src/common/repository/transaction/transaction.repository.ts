import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class TransactionRepository {
  /**
   * Create transaction
   * @returns
   */
  static async createTransaction({
    booking_id,
    user_id,
    subscription_id,
    amount,
    currency,
    reference_number,
    status = 'pending',
    type = 'order',
    provider,
  }: {
    booking_id?: string;
    user_id?: string;
    subscription_id?: string;
    amount?: number;
    currency?: string;
    reference_number?: string;
    status?: string;
    type?: string;
    provider?: string;
  }) {
    const data = {};
    if (booking_id) {
      data['booking_id'] = booking_id;
    }
    if (user_id) {
      data['user_id'] = user_id;
    }
    if (subscription_id) {
      data['subscription_id'] = subscription_id;
    }
    if (amount) {
      data['amount'] = Number(amount);
    }
    if (currency) {
      data['currency'] = currency;
    }
    if (reference_number) {
      data['reference_number'] = reference_number;
    }
    if (status) {
      data['status'] = status;
    }
    if (type) {
      data['type'] = type;
    }
    if (provider) {
      data['provider'] = provider;
    }
    return await prisma.paymentTransaction.create({
      data: {
        ...data,
      },
    });
  }

  /**
   * Create subscription transaction
   * @returns
   */
  static async createSubscriptionTransaction({
    subscription_id,
    user_id,
    amount,
    currency = 'usd',
    reference_number,
    status = 'pending',
    provider = 'stripe',
  }: {
    subscription_id: string;
    user_id: string;
    amount: number;
    currency?: string;
    reference_number?: string;
    status?: string;
    provider?: string;
  }) {
    return await prisma.paymentTransaction.create({
      data: {
        user_id,
        subscription_id,
        amount: Number(amount),
        currency,
        reference_number,
        status,
        type: 'subscription',
        provider,
      },
    });
  }

  /**
   * Update transaction
   * @returns
   */
  static async updateTransaction({
    reference_number,
    status = 'pending',
    paid_amount,
    paid_currency,
    raw_status,
  }: {
    reference_number: string;
    status: string;
    paid_amount?: number;
    paid_currency?: string;
    raw_status?: string;
  }) {
    const data = {};
    const order_data = {};
    if (status) {
      data['status'] = status;
      order_data['payment_status'] = status;
    }
    if (paid_amount) {
      data['paid_amount'] = Number(paid_amount);
      order_data['paid_amount'] = Number(paid_amount);
    }
    if (paid_currency) {
      data['paid_currency'] = paid_currency;
      order_data['paid_currency'] = paid_currency;
    }
    if (raw_status) {
      data['raw_status'] = raw_status;
      order_data['payment_raw_status'] = raw_status;
    }

    const paymentTransaction = await prisma.paymentTransaction.findMany({
      where: {
        reference_number: reference_number,
      },
    });

    // update booking status
    // if (paymentTransaction.length > 0) {
    //   await prisma.order.update({
    //     where: {
    //       id: paymentTransaction[0].order_id,
    //     },
    //     data: {
    //       ...order_data,
    //     },
    //   });
    // }

    return await prisma.paymentTransaction.updateMany({
      where: {
        reference_number: reference_number,
      },
      data: {
        ...data,
      },
    });
  }
}

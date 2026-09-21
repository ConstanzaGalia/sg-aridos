import { boolean, integer, numeric, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'

export const user = pgTable('user', { id: text('id').primaryKey(), name: text('name').notNull(), email: text('email').notNull().unique(), emailVerified: boolean('emailVerified').notNull().default(false), image: text('image'), createdAt: timestamp('createdAt').notNull().defaultNow(), updatedAt: timestamp('updatedAt').notNull().defaultNow() })
export const session = pgTable('session', { id: text('id').primaryKey(), expiresAt: timestamp('expiresAt').notNull(), token: text('token').notNull().unique(), createdAt: timestamp('createdAt').notNull().defaultNow(), updatedAt: timestamp('updatedAt').notNull().defaultNow(), ipAddress: text('ipAddress'), userAgent: text('userAgent'), userId: text('userId').notNull() })
export const account = pgTable('account', { id: text('id').primaryKey(), accountId: text('accountId').notNull(), providerId: text('providerId').notNull(), userId: text('userId').notNull(), accessToken: text('accessToken'), refreshToken: text('refreshToken'), idToken: text('idToken'), accessTokenExpiresAt: timestamp('accessTokenExpiresAt'), refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt'), scope: text('scope'), password: text('password'), createdAt: timestamp('createdAt').notNull().defaultNow(), updatedAt: timestamp('updatedAt').notNull().defaultNow() })
export const verification = pgTable('verification', { id: text('id').primaryKey(), identifier: text('identifier').notNull(), value: text('value').notNull(), expiresAt: timestamp('expiresAt').notNull(), createdAt: timestamp('createdAt').defaultNow(), updatedAt: timestamp('updatedAt').defaultNow() })

export const clients = pgTable('clients', { id: serial('id').primaryKey(), userId: text('user_id').notNull(), name: text('name').notNull(), legalName: text('legal_name'), phone: text('phone'), email: text('email'), notes: text('notes'), status: text('status').notNull().default('active'), createdAt: timestamp('created_at').notNull().defaultNow(), updatedAt: timestamp('updated_at').notNull().defaultNow() })
export const worksites = pgTable('worksites', { id: serial('id').primaryKey(), userId: text('user_id').notNull(), clientId: integer('client_id').notNull(), name: text('name').notNull(), legalName: text('legal_name'), address: text('address'), status: text('status').notNull().default('active'), notes: text('notes'), createdAt: timestamp('created_at').notNull().defaultNow(), updatedAt: timestamp('updated_at').notNull().defaultNow() })
export const jobs = pgTable('jobs', { id: serial('id').primaryKey(), userId: text('user_id').notNull(), clientId: integer('client_id').notNull(), worksiteId: integer('worksite_id'), type: text('type').notNull(), status: text('status').notNull().default('pending'), quoteId: integer('quote_id'), paymentStatus: text('payment_status').notNull().default('pending'), paidAmount: numeric('paid_amount', { precision: 12, scale: 2 }).notNull().default('0'), paidAt: timestamp('paid_at'), scheduledAt: timestamp('scheduled_at'), amount: numeric('amount', { precision: 12, scale: 2 }).notNull().default('0'), notes: text('notes'), createdAt: timestamp('created_at').notNull().defaultNow(), updatedAt: timestamp('updated_at').notNull().defaultNow() })
export const trips = pgTable('trips', { id: serial('id').primaryKey(), userId: text('user_id').notNull(), jobId: integer('job_id').notNull(), material: text('material').notNull(), price: numeric('price', { precision: 12, scale: 2 }).notNull().default('0'), quantity: numeric('quantity', { precision: 10, scale: 2 }), unit: text('unit'), truck: text('truck'), driver: text('driver'), status: text('status').notNull().default('scheduled'), scheduledAt: timestamp('scheduled_at'), createdAt: timestamp('created_at').notNull().defaultNow() })
export const catalogItems = pgTable('catalog_items', { id: serial('id').primaryKey(), userId: text('user_id').notNull(), name: text('name').notNull(), kind: text('kind').notNull(), pricingMode: text('pricing_mode').notNull(), active: boolean('active').notNull().default(true), createdAt: timestamp('created_at').notNull().defaultNow(), updatedAt: timestamp('updated_at').notNull().defaultNow() })
export const quotes = pgTable('quotes', { id: serial('id').primaryKey(), userId: text('user_id').notNull(), clientId: integer('client_id').notNull(), worksiteId: integer('worksite_id'), status: text('status').notNull().default('draft'), validUntil: timestamp('valid_until'), notes: text('notes'), total: numeric('total', { precision: 12, scale: 2 }).notNull().default('0'), createdAt: timestamp('created_at').notNull().defaultNow(), updatedAt: timestamp('updated_at').notNull().defaultNow() })
export const quoteItems = pgTable('quote_items', { id: serial('id').primaryKey(), userId: text('user_id').notNull(), quoteId: integer('quote_id').notNull(), catalogItemId: integer('catalog_item_id').notNull(), description: text('description').notNull(), quantity: numeric('quantity', { precision: 10, scale: 2 }).notNull().default('1'), unit: text('unit').notNull().default('viaje'), unitPrice: numeric('unit_price', { precision: 12, scale: 2 }).notNull().default('0'), subtotal: numeric('subtotal', { precision: 12, scale: 2 }).notNull().default('0'), distanceKm: numeric('distance_km', { precision: 10, scale: 2 }), tons: numeric('tons', { precision: 10, scale: 2 }), hours: numeric('hours', { precision: 10, scale: 2 }), notes: text('notes') })

export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  jobId: integer('job_id').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  method: text('method').notNull().default('transfer'),
  notes: text('notes'),
  paidAt: timestamp('paid_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const expenses = pgTable('expenses', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  jobId: integer('job_id'),
  worksiteId: integer('worksite_id'),
  category: text('category').notNull().default('other'),
  description: text('description').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  expenseDate: timestamp('expense_date').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

import type { Knex } from 'knex';
import bcrypt from 'bcryptjs';

export async function seed(knex: Knex): Promise<void> {
  const adminEmail = 'admin@bookprint.com';
  const existingAdmin = await knex('users').where('email', adminEmail).first();
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash('Admin@123456', 12);
    await knex('users').insert({
      email: adminEmail,
      password_hash: passwordHash,
      name: 'System Admin',
      role: 'admin',
      is_verified: true,
    });
  }

  const shopEmail = 'bookshop@demo.com';
  const existingShop = await knex('users').where('email', shopEmail).first();
  let shopOwnerId: string | null = null;
  if (!existingShop) {
    const passwordHash = await bcrypt.hash('Shop@123456', 12);
    const [user] = await knex('users').insert({
      email: shopEmail,
      password_hash: passwordHash,
      name: 'Demo Bookshop',
      role: 'bookshop_owner',
      is_verified: true,
    }).returning('id');
    shopOwnerId = user.id;
  } else {
    shopOwnerId = existingShop.id;
  }

  if (shopOwnerId) {
    const existingBookshop = await knex('bookshops').where('email', shopEmail).first();
    if (!existingBookshop) {
      await knex('bookshops').insert({
        name: 'Demo Bookshop',
        owner_id: shopOwnerId,
        address: '123 Main St, City',
        phone: '+20123456789',
        email: shopEmail,
        is_active: true,
      });
    }
  }
}

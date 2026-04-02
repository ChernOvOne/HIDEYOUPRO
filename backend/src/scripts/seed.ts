import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function seed() {
  console.log('Seeding database...')

  // ── Default tariffs ─────────────────────────────────────────
  const tariffs = [
    {
      name:            'Базовый · 1 месяц',
      description:     '500 ГБ трафика · 3 устройства',
      type:            'SUBSCRIPTION' as const,
      durationDays:    30,
      priceRub:        299,
      priceUsdt:       3.5,
      deviceLimit:     3,
      trafficGb:       500,
      trafficStrategy: 'MONTH',
      isActive:        true,
      isFeatured:      false,
      sortOrder:       1,
      remnawaveSquads: [] as string[],
    },
    {
      name:            'Стандарт · 1 месяц',
      description:     'Безлимитный трафик · 5 устройств',
      type:            'SUBSCRIPTION' as const,
      durationDays:    30,
      priceRub:        499,
      priceUsdt:       5.5,
      deviceLimit:     5,
      trafficGb:       null,
      trafficStrategy: 'MONTH',
      isActive:        true,
      isFeatured:      true,
      sortOrder:       2,
      remnawaveSquads: [] as string[],
    },
    {
      name:            'Годовой',
      description:     'Безлимитный трафик · 10 устройств · Выгода 30%',
      type:            'SUBSCRIPTION' as const,
      durationDays:    365,
      priceRub:        3990,
      priceUsdt:       44,
      deviceLimit:     10,
      trafficGb:       null,
      trafficStrategy: 'MONTH',
      isActive:        true,
      isFeatured:      false,
      sortOrder:       3,
      remnawaveSquads: [] as string[],
    },
  ]

  for (const t of tariffs) {
    const existing = await prisma.tariff.findFirst({ where: { name: t.name } })
    if (!existing) {
      await prisma.tariff.create({ data: t as any })
      console.log(`  Tariff: ${t.name}`)
    }
  }

  // ── Default settings ────────────────────────────────────────
  const settings = [
    { key: 'site_name',        value: 'HIDEYOU VPN' },
    { key: 'site_description', value: 'Быстрый и безопасный VPN' },
    { key: 'support_link',     value: '' },
    { key: 'trial_enabled',    value: 'false' },
  ]

  for (const s of settings) {
    await prisma.setting.upsert({
      where:  { key: s.key },
      update: {},
      create: s,
    })
  }

  // ── Default accounting categories ───────────────────────────
  const categories = [
    { name: 'VPN серверы',    type: 'EXPENSE' as const, color: '#ef4444', icon: 'server' },
    { name: 'Домены/SSL',     type: 'EXPENSE' as const, color: '#f97316', icon: 'globe' },
    { name: 'Реклама',        type: 'EXPENSE' as const, color: '#eab308', icon: 'megaphone' },
    { name: 'Подписки',       type: 'INCOME' as const,  color: '#22c55e', icon: 'credit-card' },
    { name: 'Пополнения',     type: 'INCOME' as const,  color: '#06b6d4', icon: 'wallet' },
    { name: 'Прочее',         type: 'EXPENSE' as const, color: '#6b7280', icon: 'box' },
  ]

  for (const c of categories) {
    const existing = await prisma.category.findFirst({ where: { name: c.name } })
    if (!existing) {
      await prisma.category.create({ data: c as any })
      console.log(`  Category: ${c.name}`)
    }
  }

  console.log('Seed complete!')
}

seed()
  .catch(err => { console.error('Seed failed:', err); process.exit(1) })
  .finally(() => prisma.$disconnect())

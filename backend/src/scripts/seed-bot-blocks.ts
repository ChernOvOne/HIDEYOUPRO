import { prisma } from '../db'

async function seedBotBlocks() {
  const existing = await prisma.botBlockGroup.count()
  if (existing > 0) {
    console.log('Bot blocks already seeded, skipping')
    return
  }

  console.log('Seeding bot blocks...')

  /* ── Groups ─────────────────────────────────── */

  const mainMenu = await prisma.botBlockGroup.create({
    data: { name: 'Главное меню', icon: '🏠', sortOrder: 0 },
  })

  const subscription = await prisma.botBlockGroup.create({
    data: { name: 'Подписка', icon: '📦', sortOrder: 1 },
  })

  const payment = await prisma.botBlockGroup.create({
    data: { name: 'Оплата', icon: '💳', sortOrder: 2 },
  })

  const help = await prisma.botBlockGroup.create({
    data: { name: 'Помощь', icon: '❓', sortOrder: 3 },
  })

  /* ── Главное меню — blocks ─────────────────── */

  const startBlock = await prisma.botBlock.create({
    data: {
      name: 'start',
      groupId: mainMenu.id,
      type: 'MESSAGE',
      text: '👋 Добро пожаловать в *HIDEYOU PRO*!\n\nВаш надёжный VPN-сервис. Выберите действие:',
      parseMode: 'Markdown',
      sortOrder: 0,
    },
  })

  await prisma.botTrigger.create({
    data: { type: 'command', value: '/start', blockId: startBlock.id, priority: 100 },
  })

  await prisma.botButton.createMany({
    data: [
      { blockId: startBlock.id, label: '📦 Подписка', type: 'callback', row: 0, col: 0, sortOrder: 0 },
      { blockId: startBlock.id, label: '💰 Тарифы', type: 'callback', row: 0, col: 1, sortOrder: 1 },
      { blockId: startBlock.id, label: '❓ Помощь', type: 'callback', row: 1, col: 0, sortOrder: 2 },
      { blockId: startBlock.id, label: '👥 Реферальная программа', type: 'callback', row: 1, col: 1, sortOrder: 3 },
    ],
  })

  const menuBlock = await prisma.botBlock.create({
    data: {
      name: 'menu',
      groupId: mainMenu.id,
      type: 'MESSAGE',
      text: '🏠 *Главное меню*\n\nВыберите действие:',
      parseMode: 'Markdown',
      sortOrder: 1,
    },
  })

  await prisma.botTrigger.create({
    data: { type: 'callback', value: 'menu', blockId: menuBlock.id, priority: 90 },
  })

  await prisma.botButton.createMany({
    data: [
      { blockId: menuBlock.id, label: '📦 Подписка', type: 'callback', row: 0, col: 0, sortOrder: 0 },
      { blockId: menuBlock.id, label: '💰 Тарифы', type: 'callback', row: 0, col: 1, sortOrder: 1 },
      { blockId: menuBlock.id, label: '❓ Помощь', type: 'callback', row: 1, col: 0, sortOrder: 2 },
      { blockId: menuBlock.id, label: '👥 Реферальная программа', type: 'callback', row: 1, col: 1, sortOrder: 3 },
    ],
  })

  /* ── Подписка — blocks ─────────────────────── */

  const subInfoBlock = await prisma.botBlock.create({
    data: {
      name: 'subscription_info',
      groupId: subscription.id,
      type: 'MESSAGE',
      text: '📦 *Ваша подписка*\n\nСтатус: {subStatus}\nДействует до: {subExpireAt}\nОсталось дней: {daysLeft}',
      parseMode: 'Markdown',
      sortOrder: 0,
    },
  })

  await prisma.botTrigger.create({
    data: { type: 'callback', value: 'subscription_info', blockId: subInfoBlock.id, priority: 80 },
  })

  await prisma.botButton.createMany({
    data: [
      { blockId: subInfoBlock.id, label: '🔄 Продлить', type: 'callback', row: 0, col: 0, sortOrder: 0 },
      { blockId: subInfoBlock.id, label: '🔙 Меню', type: 'callback', row: 1, col: 0, sortOrder: 1 },
    ],
  })

  const noSubBlock = await prisma.botBlock.create({
    data: {
      name: 'no_subscription',
      groupId: subscription.id,
      type: 'MESSAGE',
      text: '😔 У вас нет активной подписки.\n\nОформите подписку, чтобы начать пользоваться VPN.',
      parseMode: 'Markdown',
      sortOrder: 1,
    },
  })

  await prisma.botTrigger.create({
    data: { type: 'callback', value: 'no_subscription', blockId: noSubBlock.id, priority: 80 },
  })

  await prisma.botButton.createMany({
    data: [
      { blockId: noSubBlock.id, label: '💰 Выбрать тариф', type: 'callback', row: 0, col: 0, sortOrder: 0 },
      { blockId: noSubBlock.id, label: '🔙 Меню', type: 'callback', row: 1, col: 0, sortOrder: 1 },
    ],
  })

  /* ── Оплата — blocks ───────────────────────── */

  const tariffListBlock = await prisma.botBlock.create({
    data: {
      name: 'tariff_list',
      groupId: payment.id,
      type: 'MESSAGE',
      text: '💰 *Доступные тарифы*\n\nВыберите подходящий тариф для подключения VPN:',
      parseMode: 'Markdown',
      sortOrder: 0,
    },
  })

  await prisma.botTrigger.create({
    data: { type: 'callback', value: 'tariff_list', blockId: tariffListBlock.id, priority: 80 },
  })

  await prisma.botButton.createMany({
    data: [
      { blockId: tariffListBlock.id, label: '🔙 Меню', type: 'callback', row: 0, col: 0, sortOrder: 0 },
    ],
  })

  const paymentSuccessBlock = await prisma.botBlock.create({
    data: {
      name: 'payment_success',
      groupId: payment.id,
      type: 'MESSAGE',
      text: '✅ *Оплата успешна!*\n\nВаша подписка активирована. Спасибо за покупку!\n\nИспользуйте /start чтобы вернуться в главное меню.',
      parseMode: 'Markdown',
      sortOrder: 1,
    },
  })

  await prisma.botTrigger.create({
    data: { type: 'callback', value: 'payment_success', blockId: paymentSuccessBlock.id, priority: 80 },
  })

  await prisma.botButton.createMany({
    data: [
      { blockId: paymentSuccessBlock.id, label: '📦 Моя подписка', type: 'callback', row: 0, col: 0, sortOrder: 0 },
      { blockId: paymentSuccessBlock.id, label: '🔙 Меню', type: 'callback', row: 1, col: 0, sortOrder: 1 },
    ],
  })

  /* ── Помощь — blocks ───────────────────────── */

  const helpBlock = await prisma.botBlock.create({
    data: {
      name: 'help',
      groupId: help.id,
      type: 'MESSAGE',
      text: '❓ *Помощь*\n\nЕсли у вас возникли вопросы или проблемы, воспользуйтесь ссылками ниже или напишите в поддержку.',
      parseMode: 'Markdown',
      sortOrder: 0,
    },
  })

  await prisma.botTrigger.create({
    data: { type: 'command', value: '/help', blockId: helpBlock.id, priority: 90 },
  })

  await prisma.botButton.createMany({
    data: [
      { blockId: helpBlock.id, label: '💬 Поддержка', type: 'url', url: 'https://t.me/support', row: 0, col: 0, sortOrder: 0 },
      { blockId: helpBlock.id, label: '📖 Инструкции', type: 'callback', row: 0, col: 1, sortOrder: 1 },
      { blockId: helpBlock.id, label: '🔙 Меню', type: 'callback', row: 1, col: 0, sortOrder: 2 },
    ],
  })

  const instructionsBlock = await prisma.botBlock.create({
    data: {
      name: 'instructions',
      groupId: help.id,
      type: 'MESSAGE',
      text: '📖 *Инструкции*\n\nНажмите кнопку ниже для перехода к подробным инструкциям по настройке VPN.',
      parseMode: 'Markdown',
      sortOrder: 1,
    },
  })

  await prisma.botTrigger.create({
    data: { type: 'callback', value: 'instructions', blockId: instructionsBlock.id, priority: 80 },
  })

  await prisma.botButton.createMany({
    data: [
      { blockId: instructionsBlock.id, label: '📖 Открыть инструкции', type: 'url', url: 'https://docs.example.com', row: 0, col: 0, sortOrder: 0 },
      { blockId: instructionsBlock.id, label: '🔙 Помощь', type: 'callback', row: 1, col: 0, sortOrder: 1 },
      { blockId: instructionsBlock.id, label: '🏠 Меню', type: 'callback', row: 1, col: 1, sortOrder: 2 },
    ],
  })

  console.log('Seeded bot blocks:')
  console.log(`  Groups: 4 (Главное меню, Подписка, Оплата, Помощь)`)
  console.log(`  Blocks: 8`)
  console.log(`  Triggers & buttons created`)
}

seedBotBlocks()
  .then(() => {
    console.log('Done')
    return prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })

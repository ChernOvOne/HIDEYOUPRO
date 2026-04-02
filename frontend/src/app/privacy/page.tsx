'use client'

import Link from 'next/link'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-300 py-16 px-4">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <Link href="/" className="text-cyan-400 hover:text-cyan-300 text-sm">&larr; На главную</Link>
          <h1 className="text-3xl font-bold text-white mt-4">Политика конфиденциальности</h1>
          <p className="text-sm text-gray-500 mt-2">Последнее обновление: {new Date().toLocaleDateString('ru')}</p>
        </div>

        <section className="space-y-4 text-sm leading-relaxed">
          <h2 className="text-lg font-semibold text-white">1. Общие положения</h2>
          <p>Настоящая Политика конфиденциальности определяет порядок обработки и защиты персональных данных пользователей сервиса HIDEYOU VPN.</p>

          <h2 className="text-lg font-semibold text-white">2. Какие данные мы собираем</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Email-адрес (при регистрации через email)</li>
            <li>Telegram ID (при регистрации через Telegram)</li>
            <li>IP-адрес последнего входа</li>
            <li>Данные об оплатах и подписках</li>
          </ul>

          <h2 className="text-lg font-semibold text-white">3. Как мы используем данные</h2>
          <p>Персональные данные используются исключительно для предоставления услуг VPN, обработки платежей, технической поддержки и информирования о статусе подписки.</p>

          <h2 className="text-lg font-semibold text-white">4. Хранение данных</h2>
          <p>Данные хранятся на защищённых серверах. Мы не передаём персональные данные третьим лицам, за исключением случаев, предусмотренных законодательством.</p>

          <h2 className="text-lg font-semibold text-white">5. VPN-трафик</h2>
          <p>Мы <strong className="text-white">не записываем и не анализируем</strong> содержимое VPN-трафика. Собирается только объём переданных данных для учёта лимитов тарифа.</p>

          <h2 className="text-lg font-semibold text-white">6. Удаление данных</h2>
          <p>Вы можете запросить полное удаление ваших данных через службу поддержки или настройки аккаунта.</p>

          <h2 className="text-lg font-semibold text-white">7. Контакты</h2>
          <p>По вопросам конфиденциальности обращайтесь через Telegram-бот или по email, указанному в настройках сервиса.</p>
        </section>
      </div>
    </div>
  )
}

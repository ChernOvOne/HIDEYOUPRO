'use client'

import Link from 'next/link'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-300 py-16 px-4">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <Link href="/" className="text-cyan-400 hover:text-cyan-300 text-sm">&larr; На главную</Link>
          <h1 className="text-3xl font-bold text-white mt-4">Условия использования</h1>
          <p className="text-sm text-gray-500 mt-2">Последнее обновление: {new Date().toLocaleDateString('ru')}</p>
        </div>

        <section className="space-y-4 text-sm leading-relaxed">
          <h2 className="text-lg font-semibold text-white">1. Принятие условий</h2>
          <p>Используя сервис HIDEYOU VPN, вы соглашаетесь с настоящими Условиями использования. Если вы не согласны с условиями, пожалуйста, прекратите использование сервиса.</p>

          <h2 className="text-lg font-semibold text-white">2. Описание услуги</h2>
          <p>HIDEYOU VPN предоставляет услуги виртуальной частной сети (VPN) для защиты интернет-соединения и обеспечения конфиденциальности онлайн-активности.</p>

          <h2 className="text-lg font-semibold text-white">3. Оплата и подписки</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Подписка активируется после подтверждения оплаты</li>
            <li>Возврат средств возможен в течение 24 часов после оплаты, если VPN-подключение не использовалось</li>
            <li>Подписка автоматически деактивируется по истечении оплаченного периода</li>
          </ul>

          <h2 className="text-lg font-semibold text-white">4. Допустимое использование</h2>
          <p>Запрещается использовать сервис для:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Деятельности, нарушающей законодательство</li>
            <li>Распространения вредоносного ПО</li>
            <li>Массовых рассылок (спама)</li>
            <li>Атак на другие сервисы и сети</li>
          </ul>

          <h2 className="text-lg font-semibold text-white">5. Ограничение ответственности</h2>
          <p>Сервис предоставляется &laquo;как есть&raquo;. Мы не гарантируем бесперебойную работу и не несём ответственности за временные перебои в обслуживании.</p>

          <h2 className="text-lg font-semibold text-white">6. Изменение условий</h2>
          <p>Мы оставляем за собой право изменять условия использования. О существенных изменениях пользователи будут уведомлены через email или Telegram.</p>
        </section>
      </div>
    </div>
  )
}

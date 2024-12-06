'use client';

import Link from 'next/link';

function FAQPage() {
  const faqs = [
    {
      question: 'Where can I find the source code?',
      answer: (
        <span>
          The source code is available on{' '}
          <Link
            href="https://github.com/antoncoding/monarch"
            target="_blank"
            className="text-blue-500 hover:underline"
          >
            GitHub
          </Link>
          .
        </span>
      ),
    },
    {
      question: 'Where can I get help?',
      answer: (
        <span>
          Join our{' '}
          <Link
            href="https://t.me/+4NvIQoQVXsA2ZmJl"
            target="_blank"
            className="text-blue-500 hover:underline"
          >
            Telegram chat
          </Link>{' '}
          for support and discussions.
        </span>
      ),
    },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-8 text-3xl font-bold">Frequently Asked Questions</h1>
      <div className="space-y-6">
        {faqs.map((faq, index) => (
          <div key={index} className="bg-surface rounded p-6">
            <h3 className="mb-2 text-lg font-semibold">{faq.question}</h3>
            <p className="text-secondary">{faq.answer}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default FAQPage;

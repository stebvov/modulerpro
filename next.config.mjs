/** @type {import('next').NextConfig} */
const nextConfig = {
  // бібліотека Telegram (радар) — серверна, зі своїми сокетами: не збираємо її в пакет, а беремо з node_modules
  serverExternalPackages: ["telegram"],
  // Пульт задач — статичний застосунок у public/pult, живе за адресою /pult
  rewrites() {
    return [{ source: "/pult", destination: "/pult/index.html" }];
  },
  // сторінки сайту, що змінили адресу: старі посилання ведуть на нові
  redirects() {
    return [
      { source: "/novi-petrivtsi", destination: "/villa-8", permanent: true },
      { source: "/site/novi-petrivtsi", destination: "/site/villa-8", permanent: true },
    ];
  },
};

export default nextConfig;

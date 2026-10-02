/** @type {import('next').NextConfig} */
const nextConfig = {
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

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Пульт задач — статичний застосунок у public/pult, живе за адресою /pult
  rewrites() {
    return [{ source: "/pult", destination: "/pult/index.html" }];
  },
};

export default nextConfig;

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Create roles
  console.log('Creating roles...');

  const adminRole = await prisma.role.upsert({
    where: { name: 'Admin' },
    update: {},
    create: {
      name: 'Admin',
    },
  });

  const managerRole = await prisma.role.upsert({
    where: { name: 'Manager' },
    update: {},
    create: {
      name: 'Manager',
    },
  });

  console.log('✅ Roles created:', { adminRole, managerRole });

  // Create admin user
  console.log('Creating admin user...');

  const hashedPassword = await bcrypt.hash('Tairai123', 10);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@aos.local' },
    update: {
      password: hashedPassword,
      roleId: adminRole.id,
    },
    create: {
      email: 'admin@aos.local',
      password: hashedPassword,
      roleId: adminRole.id,
    },
  });

  console.log('✅ Admin user created:', {
    id: adminUser.id,
    email: adminUser.email,
    roleId: adminUser.roleId,
  });

  // Create org structure
  console.log('\nCreating org structure...');

  // Create countries
  const countriesData = [
    { name: 'Russia', code: 'RU' },
    { name: 'Kazakhstan', code: 'KZ' },
    { name: 'Indonesia', code: 'ID' },
    { name: 'United Arab Emirates', code: 'AE' },
    { name: 'United States', code: 'US' },
  ];

  const countries: Array<{
    id: string;
    name: string;
    code: string;
    createdAt: Date;
    updatedAt: Date;
  }> = [];
  for (const countryData of countriesData) {
    const country = await prisma.country.upsert({
      where: { code: countryData.code },
      update: {},
      create: countryData,
    });
    countries.push(country);
    console.log(`✅ Country created: ${country.name} (${country.code})`);
  }

  // Create brand (without countryId - it's removed from schema)
  const brand = await prisma.brand.upsert({
    where: { code: 'TEST_BRAND' },
    update: {
      name: 'Test Brand',
    },
    create: {
      name: 'Test Brand',
      code: 'TEST_BRAND',
    },
  });

  // Create/update brand-country relation through BrandCountry (link to RU)
  const ruCountryForBrand = countries.find((c) => c.code === 'RU');
  if (ruCountryForBrand) {
    await prisma.brandCountry.upsert({
      where: {
        brandId_countryId: {
          brandId: brand.id,
          countryId: ruCountryForBrand.id,
        },
      },
      update: {},
      create: {
        brandId: brand.id,
        countryId: ruCountryForBrand.id,
      },
    });
  }

  // Reload brand with countries for logging
  const brandWithCountries = await prisma.brand.findUnique({
    where: { code: 'TEST_BRAND' },
    include: {
      BrandCountry: {
        include: {
          Country: true,
        },
      },
    },
  });

  console.log('✅ Brand created:', {
    id: brand.id,
    name: brand.name,
    code: brand.code,
    countries:
      brandWithCountries?.BrandCountry.map((bc) => bc.Country.name) || [],
  });

  // Create marketplaces
  const marketplacesData = [
    { name: 'OZON', code: 'OZON' },
    { name: 'Wildberries', code: 'WB' },
    { name: 'Shopee', code: 'SHOPEE' },
    { name: 'Amazon', code: 'AMAZON' },
    { name: 'Lazada', code: 'LAZADA' },
  ];

  const marketplaces: Array<{
    id: string;
    name: string;
    code: string;
    logoUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
  }> = [];
  for (const marketplaceData of marketplacesData) {
    const marketplace = await prisma.marketplace.upsert({
      where: { code: marketplaceData.code },
      update: {},
      create: marketplaceData,
    });
    marketplaces.push(marketplace);
    console.log(
      `✅ Marketplace created: ${marketplace.name} (${marketplace.code})`,
    );
  }

  // Link marketplaces to countries
  // OZON -> RU
  const ruCountryForMarketplace = countries.find((c) => c.code === 'RU');
  const ozonMarketplace = marketplaces.find((m) => m.code === 'OZON');
  if (ruCountryForMarketplace && ozonMarketplace) {
    await prisma.marketplaceCountry.upsert({
      where: {
        marketplaceId_countryId: {
          marketplaceId: ozonMarketplace.id,
          countryId: ruCountryForMarketplace.id,
        },
      },
      update: {},
      create: {
        marketplaceId: ozonMarketplace.id,
        countryId: ruCountryForMarketplace.id,
      },
    });
  }

  // WB -> RU
  const wbMarketplace = marketplaces.find((m) => m.code === 'WB');
  if (ruCountryForMarketplace && wbMarketplace) {
    await prisma.marketplaceCountry.upsert({
      where: {
        marketplaceId_countryId: {
          marketplaceId: wbMarketplace.id,
          countryId: ruCountryForMarketplace.id,
        },
      },
      update: {},
      create: {
        marketplaceId: wbMarketplace.id,
        countryId: ruCountryForMarketplace.id,
      },
    });
  }

  // SHOPEE -> ID, KZ
  const shopeeMarketplace = marketplaces.find((m) => m.code === 'SHOPEE');
  const idCountry = countries.find((c) => c.code === 'ID');
  const kzCountry = countries.find((c) => c.code === 'KZ');
  if (shopeeMarketplace) {
    if (idCountry) {
      await prisma.marketplaceCountry.upsert({
        where: {
          marketplaceId_countryId: {
            marketplaceId: shopeeMarketplace.id,
            countryId: idCountry.id,
          },
        },
        update: {},
        create: {
          marketplaceId: shopeeMarketplace.id,
          countryId: idCountry.id,
        },
      });
    }
    if (kzCountry) {
      await prisma.marketplaceCountry.upsert({
        where: {
          marketplaceId_countryId: {
            marketplaceId: shopeeMarketplace.id,
            countryId: kzCountry.id,
          },
        },
        update: {},
        create: {
          marketplaceId: shopeeMarketplace.id,
          countryId: kzCountry.id,
        },
      });
    }
  }

  // AMAZON -> US, AE
  const amazonMarketplace = marketplaces.find((m) => m.code === 'AMAZON');
  const usCountry = countries.find((c) => c.code === 'US');
  const aeCountry = countries.find((c) => c.code === 'AE');
  if (amazonMarketplace) {
    if (usCountry) {
      await prisma.marketplaceCountry.upsert({
        where: {
          marketplaceId_countryId: {
            marketplaceId: amazonMarketplace.id,
            countryId: usCountry.id,
          },
        },
        update: {},
        create: {
          marketplaceId: amazonMarketplace.id,
          countryId: usCountry.id,
        },
      });
    }
    if (aeCountry) {
      await prisma.marketplaceCountry.upsert({
        where: {
          marketplaceId_countryId: {
            marketplaceId: amazonMarketplace.id,
            countryId: aeCountry.id,
          },
        },
        update: {},
        create: {
          marketplaceId: amazonMarketplace.id,
          countryId: aeCountry.id,
        },
      });
    }
  }

  // LAZADA -> ID, AE
  const lazadaMarketplace = marketplaces.find((m) => m.code === 'LAZADA');
  if (lazadaMarketplace) {
    if (idCountry) {
      await prisma.marketplaceCountry.upsert({
        where: {
          marketplaceId_countryId: {
            marketplaceId: lazadaMarketplace.id,
            countryId: idCountry.id,
          },
        },
        update: {},
        create: {
          marketplaceId: lazadaMarketplace.id,
          countryId: idCountry.id,
        },
      });
    }
    if (aeCountry) {
      await prisma.marketplaceCountry.upsert({
        where: {
          marketplaceId_countryId: {
            marketplaceId: lazadaMarketplace.id,
            countryId: aeCountry.id,
          },
        },
        update: {},
        create: {
          marketplaceId: lazadaMarketplace.id,
          countryId: aeCountry.id,
        },
      });
    }
  }

  console.log('✅ Marketplace countries linked');

  // Create agent scenarios
  console.log('\nCreating agent scenarios...');

  const scenarios = [
    {
      key: 'import_sales',
      name: 'Import Sales From Marketplace',
      endpoint: 'https://example.com/webhook/import_sales',
    },
    {
      key: 'import_reviews',
      name: 'Import Reviews From Marketplace',
      endpoint: 'https://example.com/webhook/import_reviews',
    },
    {
      key: 'import_advertising',
      name: 'Import Advertising Data',
      endpoint: 'https://example.com/webhook/import_advertising',
    },
  ];

  const createdScenarios: Array<{
    id: string;
    key: string;
    name: string;
    endpoint: string;
    createdAt: Date;
    updatedAt: Date;
  }> = [];

  for (const scenarioData of scenarios) {
    const scenario = await prisma.agentScenario.upsert({
      where: { key: scenarioData.key },
      update: {
        name: scenarioData.name,
        endpoint: scenarioData.endpoint,
      },
      create: scenarioData,
    });

    createdScenarios.push(scenario);
    console.log(`✅ Scenario created: ${scenario.name} (${scenario.key})`);
  }

  console.log('\n📋 Seeding completed successfully!');
  console.log('\n🔐 Admin credentials:');
  console.log('   Email: admin@aos.local');
  console.log('   Password: Tairai123');
  console.log('\n🌍 Org structure:');
  console.log(`   Countries: ${countries.length} created`);
  countries.forEach((c) => {
    console.log(`     - ${c.name} (${c.code})`);
  });
  console.log(`   Brand: ${brand.name} (${brand.code})`);
  console.log(`   Marketplaces: ${marketplaces.length} created`);
  for (const m of marketplaces) {
    console.log(`     - ${m.name} (${m.code})`);
  }
  console.log('\n🤖 Agent scenarios:');
  createdScenarios.forEach((s) => {
    console.log(`   ${s.name} (${s.key})`);
  });
  console.log('\n⚠️  Please change the password after first login!');
  console.log(
    '⚠️  Update agent scenario endpoints in database with real n8n webhook URLs!',
  );
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

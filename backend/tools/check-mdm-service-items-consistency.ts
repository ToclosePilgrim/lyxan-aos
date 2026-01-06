import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    const bad = await prisma.counterpartyOffer.findMany({
      where: {
        offerType: 'SERVICE' as any,
        item: { type: { not: 'SERVICE' as any } },
      } as any,
      select: {
        id: true,
        legalEntityId: true,
        counterpartyId: true,
        itemId: true,
        offerType: true,
        externalRef: true,
        item: { select: { type: true, code: true, name: true } },
      } as any,
      take: 2000,
    });

    if (bad.length === 0) {
      // eslint-disable-next-line no-console
      console.log('OK: No SERVICE offers linked to non-SERVICE items.');
      return;
    }

    // eslint-disable-next-line no-console
    console.error(
      `Found ${bad.length} inconsistent CounterpartyOffer rows (offerType=SERVICE but item.type!=SERVICE):`,
    );
    for (const o of bad) {
      // eslint-disable-next-line no-console
      console.error(
        JSON.stringify(
          {
            offerId: o.id,
            legalEntityId: (o as any).legalEntityId,
            counterpartyId: o.counterpartyId,
            mdmItemId: o.itemId,
            itemType: (o as any).item?.type,
            itemCode: (o as any).item?.code,
            itemName: (o as any).item?.name,
            externalRef: (o as any).externalRef ?? null,
          },
          null,
          2,
        ),
      );
    }
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});







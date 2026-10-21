const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const transcripts = await prisma.transcript.findMany({
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: {
      id: true,
      title: true,
      createdAt: true,
      analysis: true,
    }
  });
  
  if (transcripts.length > 0) {
    const t = transcripts[0];
    console.log('Latest transcript analysis:\n');
    if (t.analysis) {
      const analysis = JSON.parse(t.analysis);
      console.log(JSON.stringify(analysis, null, 2));
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

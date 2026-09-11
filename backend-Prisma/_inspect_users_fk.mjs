import prisma from './prismaClient.js';

const sql = `
SELECT tc.constraint_name, tc.table_name, kcu.column_name, ccu.table_name AS ref_table, ccu.column_name AS ref_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
WHERE ccu.table_name = 'users' AND tc.constraint_type = 'FOREIGN KEY';
`;

try {
  const rows = await prisma.$queryRawUnsafe(sql);
  console.log(JSON.stringify(rows, null, 2));
} catch (e) {
  console.error(e.message || e);
} finally {
  await prisma.$disconnect();
}

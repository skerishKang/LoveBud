const { createTree } = require('../netlify/functions/_lib/doc-store');

async function test_create() {
  try {
    const res = await createTree({
      ownerId: 'test-user-uid',
      title: 'NMIXX Test Tree',
      visibility: 'private'
    });
    console.log("Success:", res);
  } catch (err) {
    console.error("Failed:", err);
  }
}

test_create();

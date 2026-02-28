require('dotenv').config();
const app = require('./app');

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`HMS server running on http://localhost:${port}`);
});

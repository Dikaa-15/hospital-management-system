  require('dotenv').config();
// Pin the process timezone so date-only comparisons (e.g. appointment exports)
// are consistent between local dev and deployment hosts (Railway defaults to UTC),
// regardless of what timezone the host OS is set to.
process.env.TZ = process.env.TZ || 'Asia/Jakarta';
const app = require('./app');

const PORT = process.env.PORT || 3000; // Railway akan mengisi process.env.PORT secara otomatis
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
}); 

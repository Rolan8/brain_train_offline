const express = require('express');
const path = require('path');
const tasksRouter = require('./routes/tasks');

const app = express();
const PORT = process.env.PORT || 1871;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/api/tasks', tasksRouter);

// app.listen(PORT, () => console.log(`→ http://localhost:${PORT}`));

app.listen(PORT, '10.91.2.153', () => {
  console.log(`Server running on http://10.91.2.153:${PORT}`);
});
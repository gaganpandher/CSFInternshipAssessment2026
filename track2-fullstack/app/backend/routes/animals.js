const express = require('express');
const router = express.Router();
const { db } = require('../db');

router.get('/', (req, res) => {
  const page = parseInt(req.query.page) || 0;
  const limit = parseInt(req.query.limit) || 10;
  const offset = page * limit;

  const rows = db.prepare(`
    SELECT 
      a.id, a.name, a.tag_number, a.breed, a.date_of_birth, a.paddock_id,
      h.id AS h_id, h.event_type AS h_event_type, h.notes AS h_notes, h.date AS h_date, h.vet_name AS h_vet_name
    FROM animals a
    LEFT JOIN health_events h ON h.id = (
      SELECT id FROM health_events 
      WHERE animal_id = a.id 
      ORDER BY date DESC 
      LIMIT 1
    )
    LIMIT ? OFFSET ?
  `).all(limit, offset);

  const result = rows.map(row => {
    const animal = {
      id: row.id,
      name: row.name,
      tag_number: row.tag_number,
      breed: row.breed,
      date_of_birth: row.date_of_birth,
      paddock_id: row.paddock_id
    };
    
    let latest_health_event = null;
    if (row.h_id) {
      latest_health_event = {
        id: row.h_id,
        animal_id: row.id,
        event_type: row.h_event_type,
        notes: row.h_notes,
        date: row.h_date,
        vet_name: row.h_vet_name
      };
    }

    return { ...animal, latest_health_event };
  });

  res.json(result);
});

router.post('/', (req, res) => {
  const { name, tag_number, breed, date_of_birth, paddock_id } = req.body;

  if (!name || !tag_number) {
    return res.status(400).json({ error: 'name and tag_number are required' });
  }

  if (paddock_id) {
    const paddock = db.prepare('SELECT capacity, animal_count FROM paddocks WHERE id = ?').get(paddock_id);
    if (!paddock) return res.status(404).json({ error: 'Paddock not found' });
    if (paddock.animal_count >= paddock.capacity) {
      return res.status(422).json({ error: 'Paddock is at full capacity' });
    }
    db.prepare(
      'UPDATE paddocks SET animal_count = animal_count + 1 WHERE id = ?'
    ).run(paddock_id);
  }

  const result = db.prepare(
    'INSERT INTO animals (name, tag_number, breed, date_of_birth, paddock_id) VALUES (?, ?, ?, ?, ?)'
  ).run(name, tag_number, breed ?? null, date_of_birth ?? null, paddock_id ?? null);

  const animal = db.prepare('SELECT * FROM animals WHERE id = ?').get(result.lastInsertRowid);
  res.json(animal);
});

router.get('/:id', (req, res) => {
  const animal = db.prepare('SELECT * FROM animals WHERE id = ?').get(req.params.id);
  if (!animal) return res.status(404).json({ error: 'Animal not found' });
  res.json(animal);
});

router.put('/:id', (req, res) => {
  const animal = db.prepare('SELECT * FROM animals WHERE id = ?').get(req.params.id);
  if (!animal) return res.status(404).json({ error: 'Animal not found' });

  const updates = {
    name:          req.body.name          ?? animal.name,
    tag_number:    req.body.tag_number    ?? animal.tag_number,
    breed:         req.body.breed         ?? animal.breed,
    date_of_birth: req.body.date_of_birth ?? animal.date_of_birth,
    paddock_id:    'paddock_id' in req.body ? req.body.paddock_id : animal.paddock_id,
  };

  if (updates.paddock_id !== animal.paddock_id) {
    if (updates.paddock_id) {
      const paddock = db.prepare('SELECT capacity, animal_count FROM paddocks WHERE id = ?').get(updates.paddock_id);
      if (!paddock) return res.status(404).json({ error: 'Paddock not found' });
      if (paddock.animal_count >= paddock.capacity) {
        return res.status(422).json({ error: 'Paddock is at full capacity' });
      }
    }

    if (animal.paddock_id) {
      db.prepare(
        'UPDATE paddocks SET animal_count = animal_count - 1 WHERE id = ?'
      ).run(animal.paddock_id);
    }
    if (updates.paddock_id) {
      db.prepare(
        'UPDATE paddocks SET animal_count = animal_count + 1 WHERE id = ?'
      ).run(updates.paddock_id);
    }
  }

  db.prepare(`
    UPDATE animals
    SET name = ?, tag_number = ?, breed = ?, date_of_birth = ?, paddock_id = ?
    WHERE id = ?
  `).run(updates.name, updates.tag_number, updates.breed, updates.date_of_birth, updates.paddock_id, req.params.id);

  const updated = db.prepare('SELECT * FROM animals WHERE id = ?').get(req.params.id);
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  const animal = db.prepare('SELECT * FROM animals WHERE id = ?').get(req.params.id);
  if (!animal) return res.status(404).json({ error: 'Animal not found' });

  if (animal.paddock_id) {
    db.prepare(
      'UPDATE paddocks SET animal_count = animal_count - 1 WHERE id = ?'
    ).run(animal.paddock_id);
  }

  db.prepare('DELETE FROM animals WHERE id = ?').run(req.params.id);
  res.json({ message: 'deleted' });
});

router.get('/:id/health-events', (req, res) => {
  const animal = db.prepare('SELECT * FROM animals WHERE id = ?').get(req.params.id);
  if (!animal) return res.status(404).json({ error: 'Animal not found' });

  const events = db.prepare(
    'SELECT * FROM health_events WHERE animal_id = ? ORDER BY date DESC'
  ).all(req.params.id);
  res.json(events);
});

router.post('/:id/health-events', (req, res) => {
  const animal = db.prepare('SELECT * FROM animals WHERE id = ?').get(req.params.id);
  if (!animal) return res.status(404).json({ error: 'Animal not found' });

  const { event_type, notes, date, vet_name } = req.body;
  if (!event_type || !date) {
    return res.status(400).json({ error: 'event_type and date are required' });
  }

  const result = db.prepare(
    'INSERT INTO health_events (animal_id, event_type, notes, date, vet_name) VALUES (?, ?, ?, ?, ?)'
  ).run(req.params.id, event_type, notes ?? null, date, vet_name ?? null);

  const event = db.prepare('SELECT * FROM health_events WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(event);
});

router.get('/:id/weights', (req, res) => {
  const animal = db.prepare('SELECT * FROM animals WHERE id = ?').get(req.params.id);
  if (!animal) return res.status(404).json({ error: 'Animal not found' });

  const weights = db.prepare(
    'SELECT * FROM weights WHERE animal_id = ? ORDER BY date DESC'
  ).all(req.params.id);
  res.json(weights);
});

router.post('/:id/weights', (req, res) => {
  const animal = db.prepare('SELECT * FROM animals WHERE id = ?').get(req.params.id);
  if (!animal) return res.status(404).json({ error: 'Animal not found' });

  const { weight_kg, date, notes } = req.body;
  if (weight_kg === undefined || Number(weight_kg) <= 0 || isNaN(Number(weight_kg))) {
    return res.status(422).json({ error: 'weight_kg must be positive' });
  }

  const result = db.prepare(
    'INSERT INTO weights (animal_id, weight_kg, date, notes) VALUES (?, ?, ?, ?)'
  ).run(req.params.id, weight_kg, date, notes ?? null);

  const weight = db.prepare('SELECT * FROM weights WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(weight);
});

module.exports = router;

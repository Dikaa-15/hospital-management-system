const {
  getInventorySummary,
  listInventoryItems,
  getItemById,
  getItemBatches,
  listCategories,
  createInventoryItem,
  updateInventoryItem,
  setItemActiveState,
  createInventoryBatch
} = require('./inventory.service');

function pickFilters(query) {
  return {
    q: (query.q || '').trim(),
    category: (query.category || '').trim(),
    stock: (query.stock || '').trim()
  };
}

async function renderInventoryManagement(req, res) {
  const filters = pickFilters(req.query);

  try {
    const [summary, items, categories] = await Promise.all([
      getInventorySummary(),
      listInventoryItems(filters),
      listCategories()
    ]);

    const selectedId = (req.query.edit || '').trim();
    const selectedItem = selectedId ? await getItemById(selectedId) : items[0] || null;
    const selectedBatches = selectedItem ? await getItemBatches(selectedItem.id) : [];

    return res.render('pages/dashboard-admin/inventory-management', {
      title: 'Inventory Control Center',
      user: req.session.user,
      summary,
      items,
      categories,
      filters,
      selectedItem,
      selectedBatches,
      flash: req.query.flash || '',
      error: req.query.error || ''
    });
  } catch (error) {
    return res.status(500).render('pages/dashboard-admin/inventory-management', {
      title: 'Inventory Control Center',
      user: req.session.user,
      summary: { total_items: 0, low_stock_alerts: 0, expiring_soon: 0, daily_dispensed_proxy: 0 },
      items: [],
      categories: [],
      filters,
      selectedItem: null,
      selectedBatches: [],
      flash: '',
      error: `Failed to load inventory: ${error.message}`
    });
  }
}

async function handleCreateItem(req, res) {
  const itemCode = (req.body.item_code || '').trim();
  const itemName = (req.body.item_name || '').trim();
  const baseUnit = (req.body.base_unit || '').trim();

  if (!itemCode || !itemName || !baseUnit) {
    return res.redirect('/templates/dashboard-admin/inventory-management.html?error=Item%20code%2C%20name%2C%20and%20base%20unit%20are%20required');
  }

  try {
    const created = await createInventoryItem({
      itemCode,
      itemName,
      categoryId: (req.body.category_id || '').trim(),
      baseUnit,
      minStock: Number(req.body.min_stock || 0),
      isActive: req.body.is_active === '1'
    });

    return res.redirect(`/templates/dashboard-admin/inventory-management.html?flash=Item%20created&edit=${created.id}`);
  } catch (error) {
    return res.redirect(`/templates/dashboard-admin/inventory-management.html?error=${encodeURIComponent(error.message)}`);
  }
}

async function handleUpdateItem(req, res) {
  const itemId = req.params.id;
  const itemCode = (req.body.item_code || '').trim();
  const itemName = (req.body.item_name || '').trim();
  const baseUnit = (req.body.base_unit || '').trim();

  if (!itemCode || !itemName || !baseUnit) {
    return res.redirect(`/templates/dashboard-admin/inventory-management.html?error=Item%20code%2C%20name%2C%20and%20base%20unit%20are%20required&edit=${itemId}`);
  }

  try {
    await updateInventoryItem(itemId, {
      itemCode,
      itemName,
      categoryId: (req.body.category_id || '').trim(),
      baseUnit,
      minStock: Number(req.body.min_stock || 0),
      isActive: req.body.is_active === '1'
    });

    return res.redirect(`/templates/dashboard-admin/inventory-management.html?flash=Item%20updated&edit=${itemId}`);
  } catch (error) {
    return res.redirect(`/templates/dashboard-admin/inventory-management.html?error=${encodeURIComponent(error.message)}&edit=${itemId}`);
  }
}

async function handleItemStatus(req, res) {
  const itemId = req.params.id;
  const nextStatus = req.body.next_status === 'active';

  try {
    await setItemActiveState(itemId, nextStatus);
    return res.redirect('/templates/dashboard-admin/inventory-management.html?flash=Item%20status%20updated');
  } catch (error) {
    return res.redirect(`/templates/dashboard-admin/inventory-management.html?error=${encodeURIComponent(error.message)}`);
  }
}

async function handleCreateBatch(req, res) {
  const itemId = (req.body.item_id || '').trim();
  const batchNumber = (req.body.batch_number || '').trim();
  const expiryDate = (req.body.expiry_date || '').trim();
  const currentQty = Number(req.body.current_qty || 0);

  if (!itemId || !batchNumber || !expiryDate) {
    return res.redirect('/templates/dashboard-admin/inventory-management.html?error=Item%2C%20batch%20number%2C%20and%20expiry%20are%20required');
  }

  try {
    await createInventoryBatch({
      itemId,
      locationId: (req.body.location_id || '').trim(),
      batchNumber,
      expiryDate,
      currentQty
    });
    return res.redirect(`/templates/dashboard-admin/inventory-management.html?flash=Batch%20created&edit=${itemId}`);
  } catch (error) {
    return res.redirect(`/templates/dashboard-admin/inventory-management.html?error=${encodeURIComponent(error.message)}&edit=${itemId}`);
  }
}

module.exports = {
  renderInventoryManagement,
  handleCreateItem,
  handleUpdateItem,
  handleItemStatus,
  handleCreateBatch
};

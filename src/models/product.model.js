const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  originalPrice: { type: Number },
  saving: { type: Number },
  category: { type: String, required: true, trim: true },
  sizes: [{ type: String }],
  color: { type: String },
  colors: [{ type: mongoose.Schema.Types.Mixed }],
  images: [{ type: String }],
  sizeChart: { type: String }, // URL to size chart image or HTML table content
  inStock: { type: Boolean, default: true },
  fit: { type: String, trim: true },
  isFeatured: { type: Boolean, default: false }
}, { timestamps: true });

productSchema.index({ title: 'text', description: 'text', category: 'text' });

module.exports = mongoose.model('Product', productSchema);

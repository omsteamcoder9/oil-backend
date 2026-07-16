// controllers/cartController.js
import Cart from '../models/cartModel.js';
import Product from '../models/productModel.js';
import mongoose from 'mongoose';

// Add to Cart with variant support
export const addToCart = async (req, reply) => {
  try {
    const { productId, quantity = 1, variantId } = req.body;
    const userId = req.user._id;

    console.log('🛒 Backend - addToCart request:', {
      userId,
      productId,
      quantity,
      variantId,
      body: req.body
    });

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      console.error('❌ Invalid product ID:', productId);
      return reply.status(400).send({
        success: false,
        message: 'Invalid product ID'
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      console.error('❌ Product not found:', productId);
      return reply.status(404).send({
        success: false,
        message: 'Product not found'
      });
    }

    console.log('✅ Product found:', {
      name: product.name,
      basePrice: product.basePrice,
      variants: product.variants?.length || 0
    });

    let selectedPrice = product.basePrice;
    let availableStock = product.stock;
    let selectedVariant = null;
    let variantName = '';

    if (variantId) {
      selectedVariant = product.variants?.find(v => 
        v._id?.toString() === variantId || v.variantName === variantId
      );
      
      if (!selectedVariant) {
        console.error('❌ Variant not found:', variantId);
        return reply.status(404).send({
          success: false,
          message: 'Variant not found'
        });
      }
      
      selectedPrice = selectedVariant.price;
      availableStock = selectedVariant.stock;
      variantName = selectedVariant.variantName;
      
      console.log('🎯 Selected variant:', {
        variantName,
        price: selectedPrice,
        stock: availableStock
      });
    }

    console.log('📦 Stock & price check:', {
      price: selectedPrice,
      availableStock,
      requestedQuantity: quantity
    });

    if (availableStock < quantity) {
      console.error('❌ Insufficient stock:', { availableStock, quantity });
      return reply.status(400).send({
        success: false,
        message: 'Insufficient stock'
      });
    }

    let cart = await Cart.findOne({ user: userId });
    console.log('🛍️ Existing cart:', cart ? 'Found' : 'Not found');

    if (!cart) {
      cart = new Cart({
        user: userId,
        items: [],
        totalItems: 0,
        totalPrice: 0
      });
      console.log('🆕 Created new cart');
    }

    const existingItemIndex = cart.items.findIndex(item => {
      const sameProduct = item.product.toString() === productId;
      const sameVariant = item.variantId === (selectedVariant?._id?.toString() || variantId || '');
      return sameProduct && sameVariant;
    });

    console.log('🔍 Checking existing items:', {
      totalItems: cart.items.length,
      existingItemIndex,
      searchCriteria: { productId, variantId }
    });

    if (existingItemIndex > -1) {
      // ✅ REPLACE quantity instead of adding
      const newQuantity = quantity; // Just use the new quantity
      
      if (availableStock < newQuantity) {
        return reply.status(400).send({
          success: false,
          message: 'Insufficient stock for requested quantity'
        });
      }
      
      cart.items[existingItemIndex].quantity = newQuantity; // ✅ REPLACE
      console.log('📈 Replaced existing item quantity with:', newQuantity);
    } else {
      cart.items.push({
        product: productId,
        quantity,
        price: selectedPrice,
        variantId: selectedVariant?._id?.toString() || variantId || '',
        variantName,
        selectedColor: ''
      });
      console.log('➕ Added new item to cart:', {
        product: productId,
        quantity,
        price: selectedPrice,
        variantId,
        variantName
      });
    }

    // ✅ RECALCULATE TOTALS (ADDED THIS)
    cart.totalItems = cart.items.reduce((total, item) => total + item.quantity, 0);
    cart.totalPrice = cart.items.reduce((total, item) => {
      return total + (item.price * item.quantity);
    }, 0);

    console.log('🧮 Cart totals recalculated:', {
      totalItems: cart.totalItems,
      totalPrice: cart.totalPrice,
      breakdown: cart.items.map(item => `${item.quantity} × ₹${item.price} = ₹${item.quantity * item.price}`)
    });

    await cart.save();
    console.log('💾 Cart saved with updated totals');

    await cart.populate('items.product', 'name basePrice images slug stock seller variants');
    console.log('✅ Cart populated with product details');

    reply.status(200).send(cart);

  } catch (error) {
    console.error('❌ Add to Cart Error:', error);
    reply.status(500).send({
      success: false,
      message: error.message
    });
  }
};

// Get Cart
export const getCart = async (req, reply) => {
  try {
    const userId = req.user._id;

    const cart = await Cart.findOne({ user: userId })
      .populate('items.product', 'name basePrice images slug stock seller variants');

    if (!cart) {
      // Return empty cart structure
      return reply.status(200).send({
        _id: 'empty-cart',
        user: userId,
        items: [],
        totalPrice: 0,
        totalItems: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    // Return cart directly
    reply.status(200).send(cart);

  } catch (error) {
    reply.status(500).send({
      success: false,
      message: error.message
    });
  }
};

// Update Cart Item Quantity
export const updateCartItem = async (req, reply) => {
  try {
    const { itemId } = req.params;
    const { quantity } = req.body;
    const userId = req.user._id;

    if (!quantity || quantity < 1) {
      return reply.status(400).send({
        success: false,
        message: 'Quantity must be at least 1'
      });
    }

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return reply.status(404).send({
        success: false,
        message: 'Cart not found'
      });
    }

    const cartItem = cart.items.id(itemId);
    if (!cartItem) {
      return reply.status(404).send({
        success: false,
        message: 'Cart item not found'
      });
    }

    // ✅ Check stock based on variant
    const product = await Product.findById(cartItem.product);
    let availableStock = product.stock;
    
    if (cartItem.variantId) {
      const variant = product.variants?.find(v => 
        v._id?.toString() === cartItem.variantId || v.variantName === cartItem.variantId
      );
      if (variant) {
        availableStock = variant.stock;
      }
    }

    // Check stock availability
    if (availableStock < quantity) {
      return reply.status(400).send({
        success: false,
        message: 'Insufficient stock'
      });
    }

    cartItem.quantity = quantity;
    await cart.save();
    
    await cart.populate('items.product', 'name basePrice images slug seller stock variants');

    reply.status(200).send(cart);

  } catch (error) {
    reply.status(500).send({
      success: false,
      message: error.message
    });
  }
};

// Remove Item from Cart
export const removeFromCart = async (req, reply) => {
  try {
    const { itemId } = req.params;
    const userId = req.user._id;

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return reply.status(404).send({
        success: false,
        message: 'Cart not found'
      });
    }

    const cartItem = cart.items.id(itemId);
    if (!cartItem) {
      return reply.status(404).send({
        success: false,
        message: 'Cart item not found'
      });
    }

    // Remove the item
    cart.items.pull(itemId);
    
    // Recalculate totals
    cart.totalItems = cart.items.reduce((total, item) => total + item.quantity, 0);
    cart.totalPrice = cart.items.reduce((total, item) => {
      return total + (item.price * item.quantity);
    }, 0);

    await cart.save();
    
    await cart.populate('items.product', 'name basePrice images slug seller stock variants');

    reply.status(200).send(cart);

  } catch (error) {
    console.error('Remove from cart error:', error);
    reply.status(500).send({
      success: false,
      message: error.message
    });
  }
};

// Clear Cart
export const clearCart = async (req, reply) => {
  try {
    const userId = req.user._id;

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return reply.status(404).send({
        success: false,
        message: 'Cart not found'
      });
    }

    cart.items = [];
    cart.totalItems = 0;
    cart.totalPrice = 0;
    await cart.save();

    reply.status(200).send({  
      success: true,
      message: 'Cart cleared successfully',
      data: cart
    });
  } catch (error) {
    reply.status(500).send({
      success: false,
      message: error.message
    });
  }
};
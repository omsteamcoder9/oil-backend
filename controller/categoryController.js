// controllers/categoryController.js
import Category from '../models/Category.js';
import Product from '../models/productModel.js';
import mongoose from 'mongoose';
import slugify from 'slugify';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';  // ✅ ADD THIS AT THE TOP

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Save uploaded file as WebP
// ✅ Save uploaded file as WebP
const saveUploadedFile = async (file) => {
    try {
        const uploadsDir = path.join(process.cwd(), 'uploads');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const timestamp = Date.now();
        const random = Math.round(Math.random() * 1E9);
        const filename = `${timestamp}-${random}.webp`;  // ✅ Always .webp
        const filePath = path.join(uploadsDir, filename);

        const buffer = await file.toBuffer();
        
        // ✅ Convert to WebP using sharp (you need to install sharp)
        const sharp = await import('sharp');
        const webpBuffer = await sharp.default(buffer)
            .webp({ quality: 80 })  // 80% quality - good balance
            .toBuffer();
        
        fs.writeFileSync(filePath, webpBuffer);

        return `/uploads/${filename}`;
    } catch (error) {
        console.error('❌ Error saving file:', error);
        return null;
    }
};
// ✅ Delete file
const deleteFile = (filePath) => {
    if (!filePath) return false;
    try {
        const fullPath = path.join(process.cwd(), filePath);
        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
            console.log(`✅ Deleted: ${filePath}`);
            return true;
        }
        return false;
    } catch (error) {
        console.error('❌ Error deleting file:', error);
        return false;
    }
};

// ✅ 1. CREATE CATEGORY
export const createCategory = async (req, reply) => {
    try {
        const { name, description, parent, status, featured, metaTitle, metaDescription, metaKeywords, displayOrder } = req.body;

        if (!name || !name.trim()) {
            return reply.status(400).send({
                success: false,
                message: 'Category name is required'
            });
        }

        const existingCategory = await Category.findOne({ name: name.trim() });
        if (existingCategory) {
            return reply.status(400).send({
                success: false,
                message: 'Category with this name already exists'
            });
        }

        // ✅ Save image without folders
        let imagePath = null;
        if (req.uploadedFile) {
            imagePath = await saveUploadedFile(req.uploadedFile);
        }

        const slug = slugify(name.trim(), { lower: true, strict: true });
        let finalSlug = slug;
        let counter = 1;
        while (await Category.findOne({ slug: finalSlug })) {
            finalSlug = `${slug}-${counter}`;
            counter++;
        }

        let parsedMetaKeywords = [];
        if (metaKeywords) {
            if (Array.isArray(metaKeywords)) {
                parsedMetaKeywords = metaKeywords;
            } else if (typeof metaKeywords === 'string') {
                parsedMetaKeywords = metaKeywords.split(',').map(k => k.trim()).filter(Boolean);
            }
        }

        const category = new Category({
            name: name.trim(),
            slug: finalSlug,
            description: description || '',
            parent: parent || null,
            image: imagePath,
            status: status || 'active',
            featured: featured === 'true' || featured === true,
            metaTitle: metaTitle || '',
            metaDescription: metaDescription || '',
            metaKeywords: parsedMetaKeywords,
            displayOrder: parseInt(displayOrder) || 0,
            createdBy: req.user.id
        });

        await category.save();

        reply.status(201).send({
            success: true,
            message: 'Category created successfully',
            data: category
        });

    } catch (error) {
        console.error('❌ Create category error:', error);
        
        if (error.code === 11000) {
            return reply.status(400).send({
                success: false,
                message: 'Category name or slug already exists'
            });
        }

        reply.status(500).send({
            success: false,
            message: error.message || 'Failed to create category'
        });
    }
};

// ✅ 2. GET ALL CATEGORIES
export const getAllCategories = async (req, reply) => {
    try {
        const { status, featured, parent } = req.query;
        const filter = {};
        if (status) filter.status = status;
        if (featured === 'true') filter.featured = true;
        if (parent) filter.parent = parent === 'null' ? null : parent;

        const categories = await Category.find(filter)
            .populate('parent', 'name slug')
            .sort('displayOrder name');

        reply.status(200).send({
            success: true,
            count: categories.length,
            data: categories
        });
    } catch (error) {
        console.error('Get categories error:', error);
        reply.status(500).send({
            success: false,
            message: error.message
        });
    }
};

// ✅ 3. GET ACTIVE CATEGORIES
export const getActiveCategories = async (req, reply) => {
    try {
        const categories = await Category.find({ status: 'active' })
            .populate('parent', 'name slug')
            .sort('displayOrder name');

        reply.status(200).send({
            success: true,
            count: categories.length,
            data: categories
        });
    } catch (error) {
        console.error('Get active categories error:', error);
        reply.status(500).send({
            success: false,
            message: error.message
        });
    }
};

// ✅ 4. GET CATEGORY BY ID
export const getCategoryById = async (req, reply) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return reply.status(400).send({
                success: false,
                message: 'Invalid category ID'
            });
        }

        const category = await Category.findById(id)
            .populate('parent', 'name slug')
            .populate('subcategories', 'name slug image');

        if (!category) {
            return reply.status(404).send({
                success: false,
                message: 'Category not found'
            });
        }

        reply.status(200).send({
            success: true,
            data: category
        });
    } catch (error) {
        console.error('Get category error:', error);
        reply.status(500).send({
            success: false,
            message: error.message
        });
    }
};

// ✅ 5. UPDATE CATEGORY
export const updateCategory = async (req, reply) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return reply.status(400).send({
                success: false,
                message: 'Invalid category ID'
            });
        }

        const category = await Category.findById(id);
        if (!category) {
            return reply.status(404).send({
                success: false,
                message: 'Category not found'
            });
        }

        const { name, description, parent, status, featured, metaTitle, metaDescription, metaKeywords, displayOrder, deleteImage } = req.body;

        // ✅ Handle image deletion
        if (deleteImage === 'true' || deleteImage === true) {
            if (category.image) {
                deleteFile(category.image);
                category.image = null;
            }
        }

        // ✅ Handle new image (replaces old)
        if (req.uploadedFile) {
            if (category.image) {
                deleteFile(category.image);
            }
            category.image = await saveUploadedFile(req.uploadedFile);
        }

        // ✅ Update fields
        if (name && name.trim()) {
            category.name = name.trim();
            const slug = slugify(name.trim(), { lower: true, strict: true });
            let finalSlug = slug;
            let counter = 1;
            while (await Category.findOne({ slug: finalSlug, _id: { $ne: id } })) {
                finalSlug = `${slug}-${counter}`;
                counter++;
            }
            category.slug = finalSlug;
        }
        if (description !== undefined) category.description = description;
        if (parent !== undefined) category.parent = parent === 'null' ? null : parent;
        if (status) category.status = status;
        if (featured !== undefined) category.featured = featured === 'true' || featured === true;
        if (metaTitle !== undefined) category.metaTitle = metaTitle;
        if (metaDescription !== undefined) category.metaDescription = metaDescription;
        if (displayOrder !== undefined) category.displayOrder = parseInt(displayOrder) || 0;

        if (metaKeywords !== undefined) {
            if (Array.isArray(metaKeywords)) {
                category.metaKeywords = metaKeywords;
            } else if (typeof metaKeywords === 'string') {
                category.metaKeywords = metaKeywords.split(',').map(k => k.trim()).filter(Boolean);
            }
        }

        await category.save();

        reply.status(200).send({
            success: true,
            message: 'Category updated successfully',
            data: category
        });
    } catch (error) {
        console.error('Update category error:', error);
        reply.status(500).send({
            success: false,
            message: error.message
        });
    }
};

// ✅ 6. DELETE CATEGORY
export const deleteCategory = async (req, reply) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return reply.status(400).send({
                success: false,
                message: 'Invalid category ID'
            });
        }

        const category = await Category.findById(id);
        if (!category) {
            return reply.status(404).send({
                success: false,
                message: 'Category not found'
            });
        }

        const subcategories = await Category.find({ parent: id });
        if (subcategories.length > 0) {
            return reply.status(400).send({
                success: false,
                message: `Cannot delete category with ${subcategories.length} subcategory(s)`
            });
        }

        const productsCount = await Product.countDocuments({ category: id });
        if (productsCount > 0) {
            return reply.status(400).send({
                success: false,
                message: `Cannot delete category with ${productsCount} product(s)`
            });
        }

        if (category.image) {
            deleteFile(category.image);
        }

        await Category.findByIdAndDelete(id);

        reply.status(200).send({
            success: true,
            message: 'Category deleted successfully'
        });
    } catch (error) {
        console.error('Delete category error:', error);
        reply.status(500).send({
            success: false,
            message: error.message
        });
    }
};

// ✅ 7. GET CATEGORIES TREE
export const getCategoriesTree = async (req, reply) => {
    try {
        const categories = await Category.find({ status: 'active' }).sort('displayOrder name');
        
        const categoryMap = {};
        const roots = [];

        categories.forEach(category => {
            categoryMap[category._id] = { ...category.toObject(), children: [] };
        });

        categories.forEach(category => {
            if (category.parent && categoryMap[category.parent]) {
                categoryMap[category.parent].children.push(categoryMap[category._id]);
            } else {
                roots.push(categoryMap[category._id]);
            }
        });

        reply.status(200).send({
            success: true,
            data: roots
        });
    } catch (error) {
        console.error('Get categories tree error:', error);
        reply.status(500).send({
            success: false,
            message: error.message
        });
    }
};

// ✅ 8. GET CATEGORY PRODUCTS
export const getCategoryProducts = async (req, reply) => {
    try {
        const { id } = req.params;
        const { page = 1, limit = 12, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return reply.status(400).send({
                success: false,
                message: 'Invalid category ID'
            });
        }

        const category = await Category.findById(id);
        if (!category) {
            return reply.status(404).send({
                success: false,
                message: 'Category not found'
            });
        }

        const subcategories = await Category.find({ parent: id, status: 'active' });
        const categoryIds = [id, ...subcategories.map(sub => sub._id)];

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const sortConfig = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

        const [products, totalCount] = await Promise.all([
            Product.find({ category: { $in: categoryIds }, status: 'active' })
                .populate('category', 'name slug')
                .sort(sortConfig)
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            Product.countDocuments({ category: { $in: categoryIds }, status: 'active' })
        ]);

        reply.status(200).send({
            success: true,
            category: { _id: category._id, name: category.name, slug: category.slug },
            data: products,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / parseInt(limit)),
                totalProducts: totalCount,
                hasNext: skip + products.length < totalCount,
                hasPrev: parseInt(page) > 1
            }
        });
    } catch (error) {
        console.error('Get category products error:', error);
        reply.status(500).send({
            success: false,
            message: error.message
        });
    }
};
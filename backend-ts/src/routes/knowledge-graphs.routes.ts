import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const router = Router();
const prisma = new PrismaClient();

// Get all knowledge graphs
router.get('/', async (req, res) => {
  try {
    const graphs = await prisma.knowledgeGraph.findMany({
      where: { isActive: true },
      orderBy: { updatedAt: 'desc' },
    });

    const graphsWithData = graphs.map((graph: any) => ({
      ...graph,
      nodes: JSON.parse(graph.nodesData),
      links: JSON.parse(graph.linksData),
    }));

    return res.json({
      success: true,
      data: graphsWithData,
    });
  } catch (error: any) {
    console.error('Error fetching knowledge graphs:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Get knowledge graph by type
router.get('/type/:graphType', async (req, res) => {
  try {
    const { graphType } = req.params;

    const graph = await prisma.knowledgeGraph.findFirst({
      where: { graphType, isActive: true },
      orderBy: { updatedAt: 'desc' },
    });

    if (!graph) {
      return res.json({
        success: true,
        data: null,
      });
    }

    const graphWithData = {
      ...graph,
      nodes: JSON.parse(graph.nodesData),
      links: JSON.parse(graph.linksData),
    };

    return res.json({
      success: true,
      data: graphWithData,
    });
  } catch (error: any) {
    console.error('Error fetching knowledge graph:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Create or update knowledge graph
router.post('/', async (req, res) => {
  try {
    const { graphType, name, description, nodes, links } = req.body;

    if (!graphType || !name || !nodes || !links) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: graphType, name, nodes, links',
      });
    }

    // Check if graph exists
    const existing = await prisma.knowledgeGraph.findFirst({
      where: { graphType, isActive: true },
    });

    let result;

    if (existing) {
      // Update existing graph
      result = await prisma.knowledgeGraph.update({
        where: { id: existing.id },
        data: {
          name,
          description,
          nodesData: JSON.stringify(nodes),
          linksData: JSON.stringify(links),
          version: existing.version + 1,
          updatedAt: new Date(),
        },
      });
    } else {
      // Create new graph
      result = await prisma.knowledgeGraph.create({
        data: {
          graphId: randomUUID(),
          graphType,
          name,
          description,
          nodesData: JSON.stringify(nodes),
          linksData: JSON.stringify(links),
        },
      });
    }

    const graphWithData = {
      ...result,
      nodes: JSON.parse(result.nodesData),
      links: JSON.parse(result.linksData),
    };

    return res.json({
      success: true,
      data: graphWithData,
    });
  } catch (error: any) {
    console.error('Error saving knowledge graph:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Delete knowledge graph
router.delete('/:graphId', async (req, res) => {
  try {
    const { graphId } = req.params;

    await prisma.knowledgeGraph.update({
      where: { graphId },
      data: { isActive: false },
    });

    return res.json({
      success: true,
      message: 'Graph deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting knowledge graph:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;

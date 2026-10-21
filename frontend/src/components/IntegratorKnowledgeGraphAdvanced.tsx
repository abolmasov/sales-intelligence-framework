import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  IconButton,
  Paper,
  Grid,
  Tooltip,
  Fade,
  Stack,
  Button,
  ButtonGroup,
} from '@mui/material';
import {
  Close,
  ZoomIn,
  ZoomOut,
  CenterFocusStrong,
  FilterList,
  Refresh,
} from '@mui/icons-material';

interface Node extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  category: string;
  size: number;
  details?: {
    description?: string;
    highlights?: string[];
    services?: string[];
    courses?: string[];
    features?: string[];
    offerings?: string[];
    capabilities?: string[];
    relationship?: string;
    acquisitions?: string[];
  };
}

interface Link extends d3.SimulationLinkDatum<Node> {
  source: string | Node;
  target: string | Node;
  strength: number;
}

interface IntegratorKnowledgeGraphProps {
  width?: number;
  height?: number;
}

const IntegratorKnowledgeGraphAdvanced: React.FC<IntegratorKnowledgeGraphProps> = ({
  width = 1400,
  height = 900,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [hoveredNode, setHoveredNode] = useState<Node | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  // Enhanced Knowledge Graph Data
  const graphData = {
    nodes: [
      // Core
      {
        id: "Northstar Integrators", label: "Northstar Integrators", category: "core", size: 60,
        details: {
          description: "Global consulting firm driving enterprise transformation through AI-powered workflows and strategic analytics",
          highlights: ["20+ years experience", "300+ Fortune 500 clients", "Goldman Sachs & Everstone Capital backed", "Elite ServiceNow Partner", "Platinum Atlassian Partner"],
          acquisitions: ["Northstar library (2024)", "Vincerion (2023)", "ASPE"]
        }
      },

      // Strategic Services
      {
        id: "Digital Transformation", label: "Digital Transformation", category: "strategic", size: 40,
        details: {
          description: "Comprehensive transformation services to modernize enterprises",
          services: ["Strategic roadmap development", "Process optimization", "Technology modernization", "Organizational change management"]
        }
      },
      {
        id: "Agile Transformation", label: "Agile & Scaled Agile", category: "strategic", size: 40,
        details: {
          description: "Enterprise-wide agile adoption and scaling",
          services: ["SAFe implementation", "Agile coaching", "Team training", "Organizational assessment", "Agile for Hardware"]
        }
      },
      {
        id: "Product Management", label: "Product-Led Approach", category: "strategic", size: 35,
        details: {
          description: "Building internal product management capabilities",
          services: ["Product strategy", "Product owner training", "Value stream mapping", "Customer-centric delivery"]
        }
      },
      {
        id: "LPM", label: "Lean Portfolio Management", category: "strategic", size: 35,
        details: {
          description: "Aligning strategy with execution through LPM",
          services: ["Portfolio kanban", "Strategic themes", "Value stream identification", "Budget allocation"]
        }
      },
      {
        id: "DevOps", label: "DevOps & CI/CD", category: "strategic", size: 40,
        details: {
          description: "Accelerating software delivery through automation",
          services: ["CI/CD pipeline setup", "Infrastructure as code", "Cloud migration", "DevSecOps implementation"]
        }
      },

      // Platform Expertise
      {
        id: "ServiceNow", label: "ServiceNow", category: "platform", size: 40,
        details: {
          description: "Elite ServiceNow partner",
          capabilities: ["ITSM implementation", "ITOM deployment", "Custom app development", "Integration services"]
        }
      },
      {
        id: "Atlassian", label: "Atlassian", category: "platform", size: 40,
        details: {
          description: "Platinum Atlassian partner",
          offerings: ["Jira configuration", "Confluence setup", "App development", "Cloud migration", "Enterprise support"]
        }
      },
      {
        id: "Apptio", label: "Apptio Targetprocess", category: "platform", size: 30,
        details: {
          description: "Enterprise agile planning platform",
          services: ["Implementation", "Customization", "Training", "Support"]
        }
      },
      {
        id: "AWS", label: "AWS", category: "platform", size: 30,
        details: {
          description: "Cloud infrastructure and migration",
          services: ["Cloud strategy", "Migration services", "DevOps on AWS", "Cost optimization"]
        }
      },

      // Training & Certification
      {
        id: "SAFe Training", label: "SAFe Training", category: "training", size: 35,
        details: {
          description: "Authorized SAFe training provider",
          courses: ["Leading SAFe", "SAFe Scrum Master", "SAFe Product Owner", "SAFe DevOps", "SAFe for Teams", "Implementing SAFe"]
        }
      },
      {
        id: "Scrum Training", label: "Scrum Training", category: "training", size: 30,
        details: {
          description: "Professional Scrum certifications",
          courses: ["Certified Scrum Master", "Product Owner", "Scrum Developer", "Advanced Scrum Master"]
        }
      },
      {
        id: "DevOps Training", label: "DevOps Training", category: "training", size: 30,
        details: {
          description: "DevOps practices and tooling",
          courses: ["DevOps fundamentals", "CI/CD implementation", "Container orchestration", "Cloud-native development"]
        }
      },
      {
        id: "Learning Academy", label: "Northstar Integrators Learning Academy", category: "training", size: 35,
        details: {
          description: "Comprehensive learning platform",
          features: ["On-demand courses", "Live training", "Certification paths", "Custom learning tracks"]
        }
      },

      // AI Solutions
      {
        id: "IntegratorAI", label: "Northstar Integrators AI Hub", category: "ai", size: 45,
        details: {
          description: "AI-powered transformation solutions",
          offerings: ["AI strategy", "GenAI implementation", "Custom AI solutions", "AI governance"]
        }
      },
      {
        id: "CodeBoost", label: "CodeBoost", category: "ai", size: 38,
        details: {
          description: "AI-powered engineering intelligence",
          features: ["ROI measurement", "Developer productivity", "Code quality insights", "Resource optimization", "Integration with Allstacks"]
        }
      },
      {
        id: "AgileSME", label: "AgileSME", category: "ai", size: 35,
        details: {
          description: "AI-powered agile coaching assistant",
          features: ["24/7 agile coaching", "SAFe guidance", "Best practice recommendations", "Team collaboration support"]
        }
      },

      // Development Services
      {
        id: "Custom Dev", label: "Custom Development", category: "development", size: 30,
        details: {
          description: "End-to-end application development",
          services: ["Application development", "Prototype creation", "Legacy modernization", "API development"]
        }
      },
      {
        id: "Staffing", label: "Staffing Services", category: "development", size: 30,
        details: {
          description: "Technical talent and team augmentation",
          services: ["Contract staffing", "Team augmentation", "Managed teams", "Skill-based placement"]
        }
      },
      {
        id: "Migrations", label: "Migrations", category: "development", size: 30,
        details: {
          description: "Tool and platform migration services",
          services: ["Atlassian cloud migration", "Data migration", "Platform upgrades", "Legacy system migration"]
        }
      },

      // Key Partnerships
      {
        id: "Scaled Agile", label: "Scaled Agile Inc", category: "partner", size: 25,
        details: {
          description: "Gold SPCT Partner",
          relationship: "Authorized training and certification provider"
        }
      },
      {
        id: "Workato", label: "Workato", category: "partner", size: 25,
        details: {
          description: "Integration and workflow automation partner",
          relationship: "Joint solutions for enterprise connectivity"
        }
      },
      {
        id: "Planview", label: "Planview", category: "partner", size: 25,
        details: {
          description: "Portfolio and work management partner",
          relationship: "Strategic portfolio management solutions"
        }
      },
      {
        id: "Allstacks", label: "Allstacks", category: "partner", size: 25,
        details: {
          description: "Engineering intelligence platform",
          relationship: "Integrated with CodeBoost for ROI measurement"
        }
      }
    ] as Node[],
    links: [
      // Core connections
      { source: "Northstar Integrators", target: "Digital Transformation", strength: 5 },
      { source: "Northstar Integrators", target: "Agile Transformation", strength: 5 },
      { source: "Northstar Integrators", target: "Product Management", strength: 4 },
      { source: "Northstar Integrators", target: "LPM", strength: 4 },
      { source: "Northstar Integrators", target: "DevOps", strength: 5 },

      // Platform connections
      { source: "Northstar Integrators", target: "ServiceNow", strength: 5 },
      { source: "Northstar Integrators", target: "Atlassian", strength: 5 },
      { source: "Northstar Integrators", target: "Apptio", strength: 3 },
      { source: "Northstar Integrators", target: "AWS", strength: 3 },

      // Training connections
      { source: "Northstar Integrators", target: "SAFe Training", strength: 5 },
      { source: "Northstar Integrators", target: "Scrum Training", strength: 4 },
      { source: "Northstar Integrators", target: "DevOps Training", strength: 4 },
      { source: "Northstar Integrators", target: "Learning Academy", strength: 4 },

      // AI connections
      { source: "Northstar Integrators", target: "IntegratorAI", strength: 5 },
      { source: "Northstar Integrators", target: "CodeBoost", strength: 5 },
      { source: "Northstar Integrators", target: "AgileSME", strength: 4 },
      { source: "CodeBoost", target: "IntegratorAI", strength: 4 },
      { source: "AgileSME", target: "IntegratorAI", strength: 4 },

      // Development connections
      { source: "Northstar Integrators", target: "Custom Dev", strength: 3 },
      { source: "Northstar Integrators", target: "Staffing", strength: 3 },
      { source: "Northstar Integrators", target: "Migrations", strength: 3 },

      // Partner connections
      { source: "Agile Transformation", target: "Scaled Agile", strength: 4 },
      { source: "SAFe Training", target: "Scaled Agile", strength: 5 },
      { source: "ServiceNow", target: "Workato", strength: 3 },
      { source: "LPM", target: "Planview", strength: 3 },
      { source: "CodeBoost", target: "Allstacks", strength: 4 },

      // Cross-service connections
      { source: "Agile Transformation", target: "SAFe Training", strength: 5 },
      { source: "DevOps", target: "DevOps Training", strength: 4 },
      { source: "ServiceNow", target: "Digital Transformation", strength: 3 },
      { source: "Atlassian", target: "Agile Transformation", strength: 3 },
      { source: "Apptio", target: "LPM", strength: 4 },
      { source: "DevOps", target: "AWS", strength: 3 },
      { source: "Atlassian", target: "DevOps", strength: 3 },
      { source: "Product Management", target: "Agile Transformation", strength: 3 },
      { source: "CodeBoost", target: "DevOps", strength: 3 },
      { source: "AgileSME", target: "Agile Transformation", strength: 3 },
      { source: "Migrations", target: "Atlassian", strength: 3 },
      { source: "Custom Dev", target: "DevOps", strength: 2 },
      { source: "Learning Academy", target: "Digital Transformation", strength: 2 }
    ] as Link[]
  };

  // Enhanced color scheme with gradients
  const categoryColors: { [key: string]: { primary: string; secondary: string } } = {
    core: { primary: "#FF6B6B", secondary: "#FF8E8E" },
    strategic: { primary: "#4ECDC4", secondary: "#6FE5DC" },
    platform: { primary: "#45B7D1", secondary: "#6BC9E0" },
    training: { primary: "#96CEB4", secondary: "#B0E0C9" },
    ai: { primary: "#FFD93D", secondary: "#FFE66D" },
    development: { primary: "#DDA0DD", secondary: "#EAB8EA" },
    partner: { primary: "#98D8C8", secondary: "#B0E5D8" }
  };

  const legendItems = [
    { category: 'core', label: 'Core Company', color: '#FF6B6B' },
    { category: 'strategic', label: 'Strategic Services', color: '#4ECDC4' },
    { category: 'platform', label: 'Technology Platforms', color: '#45B7D1' },
    { category: 'training', label: 'Training & Certification', color: '#96CEB4' },
    { category: 'ai', label: 'AI Solutions', color: '#FFD93D' },
    { category: 'development', label: 'Development Services', color: '#DDA0DD' },
    { category: 'partner', label: 'Partnerships', color: '#98D8C8' }
  ];

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Add gradient background
    const defs = svg.append("defs");

    // Create radial gradient for background
    const bgGradient = defs.append("radialGradient")
      .attr("id", "bg-gradient")
      .attr("cx", "50%")
      .attr("cy", "50%");

    bgGradient.append("stop")
      .attr("offset", "0%")
      .attr("stop-color", "#1a1f36")
      .attr("stop-opacity", 1);

    bgGradient.append("stop")
      .attr("offset", "100%")
      .attr("stop-color", "#0f1419")
      .attr("stop-opacity", 1);

    // Add background rect
    svg.append("rect")
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "url(#bg-gradient)");

    // Create gradients for each category
    Object.entries(categoryColors).forEach(([category, colors]) => {
      const gradient = defs.append("radialGradient")
        .attr("id", `gradient-${category}`)
        .attr("cx", "40%")
        .attr("cy", "40%");

      gradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", colors.secondary);

      gradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", colors.primary);
    });

    // Create glow filter
    const filter = defs.append("filter")
      .attr("id", "glow");

    filter.append("feGaussianBlur")
      .attr("stdDeviation", "4")
      .attr("result", "coloredBlur");

    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "coloredBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // Create force simulation with enhanced physics
    const simulation = d3.forceSimulation(graphData.nodes)
      .force("link", d3.forceLink(graphData.links)
        .id((d: any) => d.id)
        .distance((d: any) => 120 + (6 - d.strength) * 20)
        .strength((d: any) => d.strength / 10))
      .force("charge", d3.forceManyBody()
        .strength(-800)
        .distanceMax(400))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide()
        .radius((d: any) => d.size + 15)
        .strength(0.8))
      .force("x", d3.forceX(width / 2).strength(0.05))
      .force("y", d3.forceY(height / 2).strength(0.05));

    // Create container for zoom
    const g = svg.append("g");

    // Add zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        setZoomLevel(event.transform.k);
      });

    svg.call(zoom as any);

    // Create arrow markers with glow
    defs.selectAll("marker")
      .data(Object.keys(categoryColors))
      .enter().append("marker")
      .attr("id", (d) => `arrow-${d}`)
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 25)
      .attr("refY", 0)
      .attr("markerWidth", 8)
      .attr("markerHeight", 8)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", (d) => categoryColors[d].primary);

    // Create links with gradient
    const link = g.append("g")
      .selectAll("line")
      .data(graphData.links)
      .enter().append("line")
      .attr("stroke", (d: any) => {
        const target = typeof d.target === 'string' ? d.target : d.target.id;
        const targetNode = graphData.nodes.find(n => n.id === target);
        return targetNode ? categoryColors[targetNode.category].primary : "#999";
      })
      .attr("stroke-opacity", 0.3)
      .attr("stroke-width", (d: any) => d.strength * 1.2)
      .attr("marker-end", (d: any) => {
        const target = typeof d.target === 'string' ? d.target : d.target.id;
        const targetNode = graphData.nodes.find(n => n.id === target);
        return targetNode ? `url(#arrow-${targetNode.category})` : "url(#arrow-core)";
      })
      .attr("filter", "url(#glow)");

    // Create particle effect for important connections
    const particles = g.append("g").selectAll("circle.particle");

    // Create nodes
    const node = g.append("g")
      .selectAll("g")
      .data(graphData.nodes)
      .enter().append("g")
      .style("cursor", "pointer")
      .call(d3.drag<any, any>()
        .on("start", (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on("end", (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }));

    // Add outer glow circle
    node.append("circle")
      .attr("r", (d: any) => d.size + 8)
      .attr("fill", (d: any) => categoryColors[d.category].primary)
      .attr("opacity", 0.2)
      .attr("filter", "url(#glow)");

    // Add main circle with gradient
    node.append("circle")
      .attr("r", (d: any) => d.size)
      .attr("fill", (d: any) => `url(#gradient-${d.category})`)
      .attr("stroke", "#fff")
      .attr("stroke-width", 3)
      .attr("filter", "url(#glow)")
      .on("mouseenter", (event, d) => {
        setHoveredNode(d);
        d3.select(event.currentTarget as Element)
          .transition()
          .duration(200)
          .attr("r", (d: any) => d.size * 1.15)
          .attr("stroke-width", 4);
      })
      .on("mouseleave", (event, d) => {
        setHoveredNode(null);
        d3.select(event.currentTarget as Element)
          .transition()
          .duration(200)
          .attr("r", (d: any) => d.size)
          .attr("stroke-width", 3);
      })
      .on("click", (event, d) => {
        setSelectedNode(d);
        setShowDetails(true);
      });

    // Add labels with better visibility
    node.append("text")
      .text((d: any) => d.label)
      .attr("text-anchor", "middle")
      .attr("dy", (d: any) => d.size + 20)
      .attr("fill", "#ffffff")
      .attr("font-size", "14px")
      .attr("font-weight", "600")
      .attr("stroke", "#000")
      .attr("stroke-width", "0.5px")
      .attr("paint-order", "stroke")
      .style("pointer-events", "none")
      .style("text-shadow", "0 2px 8px rgba(0,0,0,0.8)");

    // Update positions on simulation tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [width, height, filterCategory]);

  const handleZoomIn = () => {
    const svg = d3.select(svgRef.current);
    svg.transition().call(
      d3.zoom<SVGSVGElement, unknown>().scaleBy as any,
      1.3
    );
  };

  const handleZoomOut = () => {
    const svg = d3.select(svgRef.current);
    svg.transition().call(
      d3.zoom<SVGSVGElement, unknown>().scaleBy as any,
      0.7
    );
  };

  const handleReset = () => {
    const svg = d3.select(svgRef.current);
    svg.transition().call(
      d3.zoom<SVGSVGElement, unknown>().transform as any,
      d3.zoomIdentity
    );
    setZoomLevel(1);
  };

  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Main Graph */}
      <Paper
        elevation={6}
        sx={{
          width: '100%',
          height: height,
          overflow: 'hidden',
          borderRadius: 3,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          position: 'relative',
        }}
      >
        <svg
          ref={svgRef}
          width={width}
          height={height}
          style={{ display: 'block' }}
        />

        {/* Controls Overlay */}
        <Box
          sx={{
            position: 'absolute',
            top: 16,
            right: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            zIndex: 1000,
          }}
        >
          <ButtonGroup orientation="vertical" variant="contained">
            <Tooltip title="Zoom In" placement="left">
              <Button onClick={handleZoomIn} size="small">
                <ZoomIn />
              </Button>
            </Tooltip>
            <Tooltip title="Zoom Out" placement="left">
              <Button onClick={handleZoomOut} size="small">
                <ZoomOut />
              </Button>
            </Tooltip>
            <Tooltip title="Reset View" placement="left">
              <Button onClick={handleReset} size="small">
                <CenterFocusStrong />
              </Button>
            </Tooltip>
          </ButtonGroup>
        </Box>

        {/* Zoom Level Indicator */}
        <Chip
          label={`${(zoomLevel * 100).toFixed(0)}%`}
          size="small"
          sx={{
            position: 'absolute',
            top: 16,
            left: 16,
            zIndex: 1000,
            backgroundColor: 'rgba(0,0,0,0.7)',
            color: 'white',
          }}
        />

        {/* Legend */}
        <Paper
          sx={{
            position: 'absolute',
            bottom: 16,
            left: 16,
            padding: 2,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(10px)',
            borderRadius: 2,
            zIndex: 1000,
          }}
        >
          <Typography variant="caption" sx={{ color: 'white', fontWeight: 'bold', mb: 1, display: 'block' }}>
            Categories
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1, maxWidth: 400 }}>
            {legendItems.map((item) => (
              <Box key={item.category} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    backgroundColor: item.color,
                    boxShadow: `0 0 8px ${item.color}`,
                  }}
                />
                <Typography variant="caption" sx={{ color: 'white', fontSize: '0.7rem' }}>
                  {item.label}
                </Typography>
              </Box>
            ))}
          </Box>
        </Paper>
      </Paper>

      {/* Details Panel */}
      <Fade in={showDetails && selectedNode !== null}>
        <Card
          sx={{
            position: 'absolute',
            top: 20,
            right: 20,
            width: 400,
            maxHeight: height - 40,
            overflow: 'auto',
            zIndex: 2000,
            background: 'rgba(255, 255, 255, 0.98)',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          }}
        >
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                {selectedNode?.label}
              </Typography>
              <IconButton size="small" onClick={() => setShowDetails(false)}>
                <Close />
              </IconButton>
            </Box>

            <Chip
              label={selectedNode?.category}
              size="small"
              sx={{
                mb: 2,
                backgroundColor: selectedNode ? categoryColors[selectedNode.category].primary : '#ccc',
                color: 'white',
                fontWeight: 'bold',
              }}
            />

            {selectedNode?.details?.description && (
              <Typography variant="body2" paragraph>
                {selectedNode.details.description}
              </Typography>
            )}

            {selectedNode?.details?.highlights && selectedNode.details.highlights.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                  Highlights
                </Typography>
                <Stack spacing={0.5}>
                  {selectedNode.details.highlights.map((highlight, index) => (
                    <Chip key={index} label={highlight} size="small" variant="outlined" />
                  ))}
                </Stack>
              </Box>
            )}

            {selectedNode?.details?.services && selectedNode.details.services.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                  Services
                </Typography>
                <Stack spacing={0.5}>
                  {selectedNode.details.services.map((service, index) => (
                    <Typography key={index} variant="body2" sx={{ pl: 2 }}>
                      • {service}
                    </Typography>
                  ))}
                </Stack>
              </Box>
            )}

            {selectedNode?.details?.courses && selectedNode.details.courses.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                  Courses
                </Typography>
                <Stack spacing={0.5}>
                  {selectedNode.details.courses.map((course, index) => (
                    <Typography key={index} variant="body2" sx={{ pl: 2 }}>
                      • {course}
                    </Typography>
                  ))}
                </Stack>
              </Box>
            )}

            {selectedNode?.details?.features && selectedNode.details.features.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                  Features
                </Typography>
                <Stack spacing={0.5}>
                  {selectedNode.details.features.map((feature, index) => (
                    <Typography key={index} variant="body2" sx={{ pl: 2 }}>
                      • {feature}
                    </Typography>
                  ))}
                </Stack>
              </Box>
            )}

            {selectedNode?.details?.capabilities && selectedNode.details.capabilities.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                  Capabilities
                </Typography>
                <Stack spacing={0.5}>
                  {selectedNode.details.capabilities.map((capability, index) => (
                    <Typography key={index} variant="body2" sx={{ pl: 2 }}>
                      • {capability}
                    </Typography>
                  ))}
                </Stack>
              </Box>
            )}

            {selectedNode?.details?.offerings && selectedNode.details.offerings.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                  Offerings
                </Typography>
                <Stack spacing={0.5}>
                  {selectedNode.details.offerings.map((offering, index) => (
                    <Typography key={index} variant="body2" sx={{ pl: 2 }}>
                      • {offering}
                    </Typography>
                  ))}
                </Stack>
              </Box>
            )}
          </CardContent>
        </Card>
      </Fade>
    </Box>
  );
};

export default IntegratorKnowledgeGraphAdvanced;

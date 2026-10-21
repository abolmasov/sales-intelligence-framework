import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  IconButton,
  Collapse,
  List,
  ListItem,
  ListItemText,
  Paper,
  Divider,
} from '@mui/material';
import {
  Close,
  ZoomIn,
  ZoomOut,
  CenterFocusStrong,
  AccountTree,
} from '@mui/icons-material';

interface Node {
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
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface Link {
  source: string | Node;
  target: string | Node;
  strength: number;
}

interface IntegratorKnowledgeGraphProps {
  width?: number;
  height?: number;
}

const IntegratorKnowledgeGraph: React.FC<IntegratorKnowledgeGraphProps> = ({
  width = 1200,
  height = 800,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Knowledge Graph Data
  const graphData = {
    nodes: [
      // Core
      {
        id: "Northstar Integrators", label: "Northstar Integrators", category: "core", size: 50,
        details: {
          description: "Global consulting firm driving enterprise transformation through AI-powered workflows and strategic analytics",
          highlights: ["20+ years experience", "300+ Fortune 500 clients", "Goldman Sachs & Everstone Capital backed", "Elite ServiceNow Partner", "Platinum Atlassian Partner"],
          acquisitions: ["Northstar library (2024)", "Vincerion (2023)", "ASPE"]
        }
      },

      // Strategic Services
      {
        id: "Digital Transformation", label: "Digital Transformation", category: "strategic", size: 35,
        details: {
          description: "Comprehensive transformation services to modernize enterprises",
          services: ["Strategic roadmap development", "Process optimization", "Technology modernization", "Organizational change management"]
        }
      },
      {
        id: "Agile Transformation", label: "Agile & Scaled Agile", category: "strategic", size: 35,
        details: {
          description: "Enterprise-wide agile adoption and scaling",
          services: ["SAFe implementation", "Agile coaching", "Team training", "Organizational assessment", "Agile for Hardware"]
        }
      },
      {
        id: "Product Management", label: "Product-Led Approach", category: "strategic", size: 30,
        details: {
          description: "Building internal product management capabilities",
          services: ["Product strategy", "Product owner training", "Value stream mapping", "Customer-centric delivery"]
        }
      },
      {
        id: "LPM", label: "Lean Portfolio Management", category: "strategic", size: 30,
        details: {
          description: "Aligning strategy to execution for maximum value",
          services: ["Portfolio optimization", "Investment planning", "Value measurement", "Strategic alignment"]
        }
      },
      {
        id: "DevOps", label: "DevOps", category: "strategic", size: 35,
        details: {
          description: "Building quality and speed in deployment pipelines",
          services: ["CI/CD implementation", "Pipeline automation", "Tool integration", "DevOps training"]
        }
      },

      // Technology Platforms
      {
        id: "ServiceNow", label: "ServiceNow", category: "platform", size: 35,
        details: {
          description: "Elite Partner delivering ServiceNow transformations",
          services: ["ITSM implementation", "HR Service Delivery", "Customer Service Management", "Workflow automation", "Platform optimization"]
        }
      },
      {
        id: "Atlassian", label: "Atlassian", category: "platform", size: 35,
        details: {
          description: "Platinum Partner with 30+ marketplace apps",
          services: ["Jira implementation", "Confluence setup", "Cloud migration", "Custom app development", "Integration services"]
        }
      },
      {
        id: "Apptio", label: "Apptio/TBM", category: "platform", size: 30,
        details: {
          description: "Technology Business Management and FinOps solutions",
          services: ["IT Financial Management", "Cloud cost optimization", "Portfolio value management", "TBM implementation"]
        }
      },
      {
        id: "AWS", label: "AWS", category: "platform", size: 25,
        details: {
          description: "Advanced AWS Partner",
          services: ["Cloud migration", "Infrastructure design", "Cost optimization", "Security implementation"]
        }
      },

      // Training & Certification
      {
        id: "SAFe Training", label: "SAFe Certifications", category: "training", size: 30,
        details: {
          description: "Gold SPCT Partner offering comprehensive SAFe training",
          courses: ["Leading SAFe (SA)", "SAFe for Teams (SP)", "SAFe Scrum Master (SSM)", "SAFe Program Consultant (SPC)", "SAFe Product Owner/Manager"]
        }
      },
      {
        id: "Scrum Training", label: "Scrum & Agile", category: "training", size: 25,
        details: {
          description: "Scrum Alliance and Scrum.org certified training",
          courses: ["Certified Scrum Master", "Product Owner certification", "Agile fundamentals", "Advanced Scrum"]
        }
      },
      {
        id: "DevOps Training", label: "DevOps Training", category: "training", size: 25,
        details: {
          description: "Comprehensive DevOps education",
          courses: ["CI/CD Pipeline implementation", "Jenkins & GitHub integration", "Docker & Kubernetes", "Infrastructure as Code"]
        }
      },
      {
        id: "Learning Academy", label: "Learning Academies", category: "training", size: 25,
        details: {
          description: "Custom learning programs for enterprises",
          offerings: ["Private team training", "Prepaid learning credits", "Dojo immersive learning", "MakeDev reskill program"]
        }
      },

      // AI Solutions
      {
        id: "CodeBoost", label: "CodeBoost™", category: "ai", size: 30,
        details: {
          description: "AI-powered coding assistant solution",
          features: ["IntegratorAI integration", "Code generation", "Automated testing", "10-week implementation", "Private cloud deployment options"]
        }
      },
      {
        id: "AgileSME", label: "AgileSME AI", category: "ai", size: 25,
        details: {
          description: "Virtual Agile Coach powered by AI",
          features: ["Agile artifact generation", "Integration with Jira/Jira Align", "OKR drafting", "Story creation assistance"]
        }
      },
      {
        id: "IntegratorAI", label: "IntegratorAI Platform", category: "ai", size: 25,
        details: {
          description: "Proprietary AI platform powering Northstar Integrators solutions",
          capabilities: ["Private LLM deployment", "Secure enterprise hosting", "Custom model training", "Integration framework"]
        }
      },

      // Development Services
      {
        id: "Custom Dev", label: "Custom Development", category: "development", size: 25,
        details: {
          description: "End-to-end application development",
          services: ["Application development", "Prototype creation", "Legacy modernization", "API development"]
        }
      },
      {
        id: "Staffing", label: "Staffing Services", category: "development", size: 25,
        details: {
          description: "Technical talent and team augmentation",
          services: ["Contract staffing", "Team augmentation", "Managed teams", "Skill-based placement"]
        }
      },
      {
        id: "Migrations", label: "Migrations", category: "development", size: 25,
        details: {
          description: "Tool and platform migration services",
          services: ["Atlassian cloud migration", "Data migration", "Platform upgrades", "Legacy system migration"]
        }
      },

      // Key Partnerships
      {
        id: "Scaled Agile", label: "Scaled Agile Inc", category: "partner", size: 20,
        details: {
          description: "Gold SPCT Partner",
          relationship: "Authorized training and certification provider"
        }
      },
      {
        id: "Workato", label: "Workato", category: "partner", size: 20,
        details: {
          description: "Integration and workflow automation partner",
          relationship: "Joint solutions for enterprise connectivity"
        }
      },
      {
        id: "Planview", label: "Planview", category: "partner", size: 20,
        details: {
          description: "Portfolio and work management partner",
          relationship: "Strategic portfolio management solutions"
        }
      },
      {
        id: "Allstacks", label: "Allstacks", category: "partner", size: 20,
        details: {
          description: "Engineering intelligence platform",
          relationship: "Integrated with CodeBoost for ROI measurement"
        }
      }
    ] as Node[],
    links: [
      // Core connections
      { source: "Northstar Integrators", target: "Digital Transformation", strength: 3 },
      { source: "Northstar Integrators", target: "Agile Transformation", strength: 3 },
      { source: "Northstar Integrators", target: "Product Management", strength: 2 },
      { source: "Northstar Integrators", target: "LPM", strength: 2 },
      { source: "Northstar Integrators", target: "DevOps", strength: 3 },

      // Platform connections
      { source: "Northstar Integrators", target: "ServiceNow", strength: 3 },
      { source: "Northstar Integrators", target: "Atlassian", strength: 3 },
      { source: "Northstar Integrators", target: "Apptio", strength: 2 },
      { source: "Northstar Integrators", target: "AWS", strength: 2 },

      // Training connections
      { source: "Northstar Integrators", target: "SAFe Training", strength: 3 },
      { source: "Northstar Integrators", target: "Scrum Training", strength: 2 },
      { source: "Northstar Integrators", target: "DevOps Training", strength: 2 },
      { source: "Northstar Integrators", target: "Learning Academy", strength: 2 },

      // AI connections
      { source: "Northstar Integrators", target: "CodeBoost", strength: 3 },
      { source: "Northstar Integrators", target: "AgileSME", strength: 2 },
      { source: "CodeBoost", target: "IntegratorAI", strength: 3 },
      { source: "AgileSME", target: "IntegratorAI", strength: 3 },

      // Development connections
      { source: "Northstar Integrators", target: "Custom Dev", strength: 2 },
      { source: "Northstar Integrators", target: "Staffing", strength: 2 },
      { source: "Northstar Integrators", target: "Migrations", strength: 2 },

      // Partner connections
      { source: "Agile Transformation", target: "Scaled Agile", strength: 3 },
      { source: "SAFe Training", target: "Scaled Agile", strength: 3 },
      { source: "ServiceNow", target: "Workato", strength: 2 },
      { source: "LPM", target: "Planview", strength: 2 },
      { source: "CodeBoost", target: "Allstacks", strength: 2 },

      // Cross-service connections
      { source: "Agile Transformation", target: "SAFe Training", strength: 3 },
      { source: "DevOps", target: "DevOps Training", strength: 3 },
      { source: "ServiceNow", target: "Digital Transformation", strength: 2 },
      { source: "Atlassian", target: "Agile Transformation", strength: 2 },
      { source: "Apptio", target: "LPM", strength: 2 },
      { source: "DevOps", target: "AWS", strength: 2 },
      { source: "Atlassian", target: "DevOps", strength: 2 },
      { source: "Product Management", target: "Agile Transformation", strength: 2 },
      { source: "CodeBoost", target: "DevOps", strength: 2 },
      { source: "AgileSME", target: "Agile Transformation", strength: 2 },
      { source: "Migrations", target: "Atlassian", strength: 2 },
      { source: "Custom Dev", target: "DevOps", strength: 1 },
      { source: "Learning Academy", target: "Digital Transformation", strength: 1 }
    ] as Link[]
  };

  // Color scheme for categories
  const categoryColors: { [key: string]: string } = {
    core: "#FF6B6B",
    strategic: "#4ECDC4",
    platform: "#45B7D1",
    training: "#96CEB4",
    ai: "#FFEAA7",
    development: "#DDA0DD",
    partner: "#98D8C8"
  };

  const legendItems = [
    { category: 'core', label: 'Core Company', color: '#FF6B6B' },
    { category: 'strategic', label: 'Strategic Services', color: '#4ECDC4' },
    { category: 'platform', label: 'Technology Platforms', color: '#45B7D1' },
    { category: 'training', label: 'Training & Certification', color: '#96CEB4' },
    { category: 'ai', label: 'AI Solutions', color: '#FFEAA7' },
    { category: 'development', label: 'Development Services', color: '#DDA0DD' },
    { category: 'partner', label: 'Partnerships', color: '#98D8C8' }
  ];

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Create force simulation
    const simulation = d3.forceSimulation(graphData.nodes)
      .force("link", d3.forceLink(graphData.links)
        .id((d: any) => d.id)
        .distance((d: any) => 100 + (3 - d.strength) * 30))
      .force("charge", d3.forceManyBody().strength(-500))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius((d: any) => d.size + 10));

    // Create arrow markers
    svg.append("defs").selectAll("marker")
      .data(["end"])
      .enter().append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 20)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#999");

    // Create links
    const link = svg.append("g")
      .selectAll("line")
      .data(graphData.links)
      .enter().append("line")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.4)
      .attr("stroke-width", (d: any) => d.strength)
      .attr("marker-end", "url(#arrow)");

    // Create nodes
    const node = svg.append("g")
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

    // Add circles for nodes
    node.append("circle")
      .attr("r", (d: any) => d.size)
      .attr("fill", (d: any) => categoryColors[d.category])
      .attr("stroke", "#fff")
      .attr("stroke-width", 2)
      .on("click", (event, d) => {
        setSelectedNode(d);
        setShowDetails(true);
      })
      .on("mouseover", function(event, d) {
        d3.select(this).transition()
          .duration(200)
          .attr("r", (d: any) => d.size * 1.1);
      })
      .on("mouseout", function(event, d) {
        d3.select(this).transition()
          .duration(200)
          .attr("r", (d: any) => d.size);
      });

    // Add labels
    node.append("text")
      .attr("dy", (d: any) => d.size + 15)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .style("font-weight", "600")
      .style("fill", "white")
      .style("text-shadow", "1px 1px 3px rgba(0,0,0,0.7)")
      .style("pointer-events", "none")
      .text((d: any) => d.label);

    // Update positions on tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node
        .attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    // Add zoom functionality
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 3])
      .on("zoom", (event) => {
        svg.selectAll("g").attr("transform", event.transform);
      });

    svg.call(zoom);

  }, [width, height]);

  const handleCloseDetails = () => {
    setShowDetails(false);
    setSelectedNode(null);
  };

  return (
    <Box sx={{ position: 'relative', width: '100%', height: height }}>
      {/* Graph Container */}
      <Box
        sx={{
          width: '100%',
          height: '100%',
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          borderRadius: 3,
          overflow: 'hidden',
          position: 'relative',
          border: '1px solid #334155',
        }}
      >
        <svg
          ref={svgRef}
          width={width}
          height={height}
          style={{ display: 'block' }}
        />

        {/* Title */}
        <Box
          sx={{
            position: 'absolute',
            top: 20,
            left: 20,
            color: 'white',
            fontSize: '24px',
            fontWeight: 600,
            textShadow: '1px 1px 2px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: 1.5
          }}
        >
          <AccountTree sx={{ fontSize: 28 }} />
          Northstar Integrators Services Knowledge Graph
        </Box>

        {/* Legend */}
        <Paper
          elevation={2}
          sx={{
            position: 'absolute',
            bottom: 20,
            left: 20,
            p: 2,
            background: 'rgba(30, 35, 50, 0.95)',
            backdropFilter: 'blur(10px)',
            borderRadius: 2,
            minWidth: 250,
            color: '#ffffff',
            zIndex: 10,
          }}
        >
          <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600, color: '#ffffff' }}>
            Service Categories
          </Typography>
          {legendItems.map((item) => (
            <Box key={item.category} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Box
                sx={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  backgroundColor: item.color,
                  mr: 2,
                  border: '2px solid #fff',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                }}
              />
              <Typography variant="caption" sx={{ fontSize: '0.85rem', color: '#ffffff' }}>
                {item.label}
              </Typography>
            </Box>
          ))}
        </Paper>

        {/* Details Panel */}
        <Collapse in={showDetails} orientation="horizontal">
          <Card
            elevation={3}
            sx={{
              position: 'absolute',
              top: 20,
              right: 20,
              width: 400,
              maxHeight: '80vh',
              overflow: 'auto',
              background: 'rgba(30, 35, 50, 0.95)',
              backdropFilter: 'blur(10px)',
              color: '#ffffff',
              zIndex: 20,
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h5" sx={{ fontWeight: 600, color: '#ffffff' }}>
                  {selectedNode?.label}
                </Typography>
                <IconButton onClick={handleCloseDetails} size="small" sx={{ color: '#ffffff' }}>
                  <Close />
                </IconButton>
              </Box>

              <Chip
                label={selectedNode?.category.replace('_', ' ').toUpperCase()}
                size="small"
                sx={{
                  backgroundColor: selectedNode ? categoryColors[selectedNode.category] : '#ccc',
                  color: 'white',
                  fontWeight: 600,
                  mb: 2
                }}
              />

              {selectedNode?.details?.description && (
                <Typography variant="body1" sx={{ mb: 2, lineHeight: 1.6, color: '#ffffff' }}>
                  {selectedNode.details.description}
                </Typography>
              )}

              {selectedNode?.details?.highlights && (
                <>
                  <Typography variant="h6" sx={{ mt: 2, mb: 1, fontWeight: 600, color: '#ffffff' }}>
                    Key Highlights
                  </Typography>
                  <List dense>
                    {selectedNode.details.highlights.map((item, index) => (
                      <ListItem key={index} sx={{ py: 0.5 }}>
                        <ListItemText primary={`• ${item}`} sx={{ color: '#ffffff' }} />
                      </ListItem>
                    ))}
                  </List>
                </>
              )}

              {selectedNode?.details?.services && (
                <>
                  <Typography variant="h6" sx={{ mt: 2, mb: 1, fontWeight: 600, color: '#ffffff' }}>
                    Services
                  </Typography>
                  <List dense>
                    {selectedNode.details.services.map((item, index) => (
                      <ListItem key={index} sx={{ py: 0.5 }}>
                        <ListItemText primary={`• ${item}`} sx={{ color: '#ffffff' }} />
                      </ListItem>
                    ))}
                  </List>
                </>
              )}

              {selectedNode?.details?.courses && (
                <>
                  <Typography variant="h6" sx={{ mt: 2, mb: 1, fontWeight: 600, color: '#ffffff' }}>
                    Courses & Certifications
                  </Typography>
                  <List dense>
                    {selectedNode.details.courses.map((item, index) => (
                      <ListItem key={index} sx={{ py: 0.5 }}>
                        <ListItemText primary={`• ${item}`} sx={{ color: '#ffffff' }} />
                      </ListItem>
                    ))}
                  </List>
                </>
              )}

              {selectedNode?.details?.features && (
                <>
                  <Typography variant="h6" sx={{ mt: 2, mb: 1, fontWeight: 600, color: '#ffffff' }}>
                    Features
                  </Typography>
                  <List dense>
                    {selectedNode.details.features.map((item, index) => (
                      <ListItem key={index} sx={{ py: 0.5 }}>
                        <ListItemText primary={`• ${item}`} sx={{ color: '#ffffff' }} />
                      </ListItem>
                    ))}
                  </List>
                </>
              )}

              {selectedNode?.details?.offerings && (
                <>
                  <Typography variant="h6" sx={{ mt: 2, mb: 1, fontWeight: 600, color: '#ffffff' }}>
                    Offerings
                  </Typography>
                  <List dense>
                    {selectedNode.details.offerings.map((item, index) => (
                      <ListItem key={index} sx={{ py: 0.5 }}>
                        <ListItemText primary={`• ${item}`} sx={{ color: '#ffffff' }} />
                      </ListItem>
                    ))}
                  </List>
                </>
              )}

              {selectedNode?.details?.capabilities && (
                <>
                  <Typography variant="h6" sx={{ mt: 2, mb: 1, fontWeight: 600, color: '#ffffff' }}>
                    Capabilities
                  </Typography>
                  <List dense>
                    {selectedNode.details.capabilities.map((item, index) => (
                      <ListItem key={index} sx={{ py: 0.5 }}>
                        <ListItemText primary={`• ${item}`} sx={{ color: '#ffffff' }} />
                      </ListItem>
                    ))}
                  </List>
                </>
              )}

              {selectedNode?.details?.relationship && (
                <>
                  <Typography variant="h6" sx={{ mt: 2, mb: 1, fontWeight: 600, color: '#ffffff' }}>
                    Partnership
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#ffffff' }}>
                    {selectedNode.details.relationship}
                  </Typography>
                </>
              )}

              {selectedNode?.details?.acquisitions && (
                <>
                  <Typography variant="h6" sx={{ mt: 2, mb: 1, fontWeight: 600, color: '#ffffff' }}>
                    Acquisitions
                  </Typography>
                  <List dense>
                    {selectedNode.details.acquisitions.map((item, index) => (
                      <ListItem key={index} sx={{ py: 0.5 }}>
                        <ListItemText primary={`• ${item}`} sx={{ color: '#ffffff' }} />
                      </ListItem>
                    ))}
                  </List>
                </>
              )}
            </CardContent>
          </Card>
        </Collapse>
      </Box>
    </Box>
  );
};

export default IntegratorKnowledgeGraph;
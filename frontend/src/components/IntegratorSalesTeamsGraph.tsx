import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Paper,
  Avatar,
  Divider,
  Stack,
} from '@mui/material';
import {
  Person,
  Group,
  Business,
  TrendingUp,
  Refresh,
} from '@mui/icons-material';

interface IntegratorSalesTeamsGraphProps {
  width?: number;
  height?: number;
}

interface Node extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  role: string;
  level: number;
  type: string;
  specialization?: string;
  region?: string;
  reports_to?: string;
  focus?: string[];
  quota?: string;
  accounts?: number;
  size?: number;
  industries?: string[];
}

interface Link {
  source: string | Node;
  target: string | Node;
  type: string;
  strength?: number;
}

const IntegratorSalesTeamsGraph: React.FC<IntegratorSalesTeamsGraphProps> = ({
  width = 1200,
  height = 800,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [viewMode, setViewMode] = useState('hierarchy');
  const [filterOption, setFilterOption] = useState('all');

  // Comprehensive sales organization data
  const graphData = {
    nodes: [
      // Executive Level
      { id: "ceo", name: "Anne Steiner", role: "CEO/President", level: 1, type: "executive", specialization: "Overall Strategy" },
      { id: "vp_sales", name: "Niles Love", role: "VP Sales", level: 2, type: "executive", specialization: "Sales Strategy", reports_to: "ceo" },
      { id: "svp_gtm", name: "Krishna Indukumar", role: "SVP GTM & Technology", level: 2, type: "executive", specialization: "Go-to-Market Strategy", reports_to: "ceo" },

      // Regional Sales Directors
      { id: "dir_americas", name: "James Mitchell", role: "Director - Americas Sales", level: 3, type: "director", region: "Americas", reports_to: "vp_sales" },
      { id: "dir_emea", name: "Sarah Thompson", role: "Director - EMEA Sales", level: 3, type: "director", region: "EMEA", reports_to: "vp_sales" },
      { id: "dir_apac", name: "Raj Patel", role: "Director - APAC Sales", level: 3, type: "director", region: "APAC", reports_to: "vp_sales" },

      // Practice Area Sales Leads
      { id: "lead_agile", name: "Michael Chen", role: "Sales Lead - Agile/SAFe Practice", level: 4, type: "practice_lead", specialization: "Agile Transformation", reports_to: "dir_americas", focus: ["SAFe", "Scrum", "Kanban", "Lean"] },
      { id: "lead_devops", name: "Jennifer Rodriguez", role: "Sales Lead - DevOps & Cloud", level: 4, type: "practice_lead", specialization: "DevOps", reports_to: "dir_americas", focus: ["CI/CD", "Cloud Migration", "AWS", "Azure"] },
      { id: "lead_ai", name: "David Kim", role: "Sales Lead - AI/ML Practice", level: 4, type: "practice_lead", specialization: "AI/ML", reports_to: "dir_americas", focus: ["Machine Learning", "GenAI", "MLOps", "AI Strategy"] },
      { id: "lead_atlassian", name: "Emily Watson", role: "Sales Lead - Atlassian Solutions", level: 4, type: "practice_lead", specialization: "Atlassian", reports_to: "dir_americas", focus: ["Jira", "Confluence", "Jira Align", "Cloud Migration"] },
      { id: "lead_servicenow", name: "Robert Anderson", role: "Sales Lead - ServiceNow", level: 4, type: "practice_lead", specialization: "ServiceNow", reports_to: "dir_americas", focus: ["ITSM", "HRSD", "Custom Apps", "Workflow Automation"] },
      { id: "lead_apptio", name: "Lisa Martinez", role: "Sales Lead - Apptio/FinOps", level: 4, type: "practice_lead", specialization: "FinOps", reports_to: "dir_americas", focus: ["TBM", "Cost Optimization", "Targetprocess", "Portfolio Management"] },

      // Sales Teams - Agile/SAFe Specialization
      { id: "team_safe_enterprise", name: "Enterprise SAFe Team", role: "Sales Team", level: 5, type: "team", specialization: "SAFe", reports_to: "lead_agile", size: 8, industries: ["Finance", "Healthcare", "Manufacturing"] },
      { id: "rep_safe_1", name: "Alex Johnson", role: "Sr. Sales Rep - SAFe", level: 6, type: "rep", specialization: "SAFe", reports_to: "team_safe_enterprise", quota: "$2.5M", accounts: 15 },
      { id: "rep_safe_2", name: "Maria Garcia", role: "Sales Rep - SAFe", level: 6, type: "rep", specialization: "SAFe", reports_to: "team_safe_enterprise", quota: "$1.8M", accounts: 20 },
      { id: "rep_safe_3", name: "Tom Wilson", role: "Sales Rep - SAFe", level: 6, type: "rep", specialization: "SAFe", reports_to: "team_safe_enterprise", quota: "$1.5M", accounts: 18 },

      // Sales Teams - AI/ML Specialization
      { id: "team_ai_enterprise", name: "Enterprise AI Team", role: "Sales Team", level: 5, type: "team", specialization: "AI/ML", reports_to: "lead_ai", size: 6, industries: ["Finance", "Retail", "Technology"] },
      { id: "rep_ai_1", name: "Priya Sharma", role: "Sr. Sales Rep - AI/ML", level: 6, type: "rep", specialization: "AI/ML", reports_to: "team_ai_enterprise", quota: "$3M", accounts: 10, focus: ["Financial Services AI"] },
      { id: "rep_ai_2", name: "John Davis", role: "Sales Rep - GenAI", level: 6, type: "rep", specialization: "AI/ML", reports_to: "team_ai_enterprise", quota: "$2M", accounts: 12, focus: ["Generative AI Solutions"] },
      { id: "rep_ai_3", name: "Sophie Chen", role: "Sales Rep - MLOps", level: 6, type: "rep", specialization: "AI/ML", reports_to: "team_ai_enterprise", quota: "$1.7M", accounts: 15, focus: ["ML Operations"] },

      // Sales Teams - DevOps/Cloud Specialization
      { id: "team_devops", name: "DevOps Sales Team", role: "Sales Team", level: 5, type: "team", specialization: "DevOps", reports_to: "lead_devops", size: 7, industries: ["Technology", "E-commerce", "SaaS"] },
      { id: "rep_devops_1", name: "Mark Stevens", role: "Sr. Sales Rep - Cloud", level: 6, type: "rep", specialization: "DevOps", reports_to: "team_devops", quota: "$2.2M", accounts: 14, focus: ["Cloud Migration"] },
      { id: "rep_devops_2", name: "Nina Patel", role: "Sales Rep - CI/CD", level: 6, type: "rep", specialization: "DevOps", reports_to: "team_devops", quota: "$1.6M", accounts: 18, focus: ["Pipeline Automation"] },

      // Sales Teams - Atlassian Specialization
      { id: "team_atlassian", name: "Atlassian Sales Team", role: "Sales Team", level: 5, type: "team", specialization: "Atlassian", reports_to: "lead_atlassian", size: 10, industries: ["All Industries"] },
      { id: "rep_atlassian_1", name: "Chris Brown", role: "Sr. Sales Rep - Jira", level: 6, type: "rep", specialization: "Atlassian", reports_to: "team_atlassian", quota: "$2M", accounts: 25, focus: ["Jira & Jira Align"] },
      { id: "rep_atlassian_2", name: "Amanda Lee", role: "Sales Rep - Cloud Migration", level: 6, type: "rep", specialization: "Atlassian", reports_to: "team_atlassian", quota: "$1.5M", accounts: 30, focus: ["Cloud Migrations"] },

      // Sales Teams - ServiceNow Specialization
      { id: "team_servicenow", name: "ServiceNow Sales Team", role: "Sales Team", level: 5, type: "team", specialization: "ServiceNow", reports_to: "lead_servicenow", size: 5, industries: ["Healthcare", "Government", "Enterprise"] },
      { id: "rep_servicenow_1", name: "Daniel Moore", role: "Sr. Sales Rep - ITSM", level: 6, type: "rep", specialization: "ServiceNow", reports_to: "team_servicenow", quota: "$2.8M", accounts: 8, focus: ["IT Service Management"] },
      { id: "rep_servicenow_2", name: "Rachel Green", role: "Sales Rep - HRSD", level: 6, type: "rep", specialization: "ServiceNow", reports_to: "team_servicenow", quota: "$1.9M", accounts: 10, focus: ["HR Service Delivery"] },

      // Sales Teams - Apptio/FinOps Specialization
      { id: "team_finops", name: "FinOps Sales Team", role: "Sales Team", level: 5, type: "team", specialization: "FinOps", reports_to: "lead_apptio", size: 4, industries: ["Finance", "Technology", "Telecommunications"] },
      { id: "rep_finops_1", name: "Brian Taylor", role: "Sr. Sales Rep - TBM", level: 6, type: "rep", specialization: "FinOps", reports_to: "team_finops", quota: "$2.3M", accounts: 12, focus: ["Technology Business Management"] },
      { id: "rep_finops_2", name: "Jessica Wang", role: "Sales Rep - Cost Optimization", level: 6, type: "rep", specialization: "FinOps", reports_to: "team_finops", quota: "$1.7M", accounts: 15, focus: ["Cloud Cost Optimization"] },

      // Industry Vertical Teams
      { id: "team_finance", name: "Financial Services Team", role: "Industry Team", level: 5, type: "team", specialization: "Industry", reports_to: "vp_sales", size: 6, industries: ["Banking", "Insurance", "FinTech"] },
      { id: "team_healthcare", name: "Healthcare Team", role: "Industry Team", level: 5, type: "team", specialization: "Industry", reports_to: "vp_sales", size: 5, industries: ["Healthcare", "Pharmaceuticals", "Medical Devices"] },
      { id: "team_gov", name: "Government Team", role: "Industry Team", level: 5, type: "team", specialization: "Industry", reports_to: "vp_sales", size: 4, industries: ["Federal", "State", "Local Government"] },

      // EMEA Teams
      { id: "team_emea_agile", name: "EMEA Agile Team", role: "Sales Team", level: 4, type: "team", specialization: "Agile", reports_to: "dir_emea", size: 5, region: "EMEA" },
      { id: "team_emea_tech", name: "EMEA Tech Team", role: "Sales Team", level: 4, type: "team", specialization: "Technology", reports_to: "dir_emea", size: 4, region: "EMEA" },

      // APAC Teams
      { id: "team_apac_enterprise", name: "APAC Enterprise Team", role: "Sales Team", level: 4, type: "team", specialization: "Enterprise", reports_to: "dir_apac", size: 6, region: "APAC" },
      { id: "team_apac_smb", name: "APAC SMB Team", role: "Sales Team", level: 4, type: "team", specialization: "SMB", reports_to: "dir_apac", size: 4, region: "APAC" }
    ] as Node[],
    links: [] as Link[]
  };

  // Generate links based on reporting structure
  graphData.nodes.forEach(node => {
    if (node.reports_to) {
      graphData.links.push({
        source: node.reports_to,
        target: node.id,
        type: "reports_to"
      });
    }
  });

  // Add cross-functional collaboration links
  graphData.links.push(
    { source: "lead_agile", target: "lead_atlassian", type: "collaboration", strength: 0.8 },
    { source: "lead_devops", target: "lead_ai", type: "collaboration", strength: 0.7 },
    { source: "lead_servicenow", target: "lead_apptio", type: "collaboration", strength: 0.6 },
    { source: "team_ai_enterprise", target: "team_devops", type: "collaboration", strength: 0.5 },
    { source: "team_safe_enterprise", target: "team_atlassian", type: "collaboration", strength: 0.7 }
  );

  // Color scales
  const colorScale = d3.scaleOrdinal<string>()
    .domain(["executive", "director", "practice_lead", "team", "rep"])
    .range(["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7"]);

  const categoryColors = {
    "executive": "#FF6B6B",
    "director": "#4ECDC4",
    "practice_lead": "#45B7D1",
    "team": "#96CEB4",
    "rep": "#FFEAA7"
  };

  // Statistics
  const stats = {
    totalTeams: graphData.nodes.filter(n => n.type === "team").length,
    totalReps: graphData.nodes.filter(n => n.type === "rep").length,
    totalSpecializations: [...new Set(graphData.nodes.map(n => n.specialization).filter(s => s))].length,
    totalRegions: [...new Set(graphData.nodes.map(n => n.region).filter(r => r))].length
  };

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Add gradient background
    const defs = svg.append("defs");

    // Create radial gradient for background
    const bgGradient = defs.append("radialGradient")
      .attr("id", "sales-bg-gradient")
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
      .attr("fill", "url(#sales-bg-gradient)");

    // Create glow filter
    const filter = defs.append("filter")
      .attr("id", "sales-glow");

    filter.append("feGaussianBlur")
      .attr("stdDeviation", "3")
      .attr("result", "coloredBlur");

    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "coloredBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    const g = svg.append("g");

    // Add zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom);

    // Set initial positions based on hierarchy level
    const levelHeight = height / 8; // Divide canvas into levels
    graphData.nodes.forEach((node) => {
      // Position nodes horizontally based on their type and index
      const nodesAtLevel = graphData.nodes.filter(n => n.level === node.level);
      const indexAtLevel = nodesAtLevel.indexOf(node);
      const spacing = width / (nodesAtLevel.length + 1);

      node.x = spacing * (indexAtLevel + 1);
      node.y = levelHeight * node.level;
    });

    // Create force simulation with hierarchy-aware forces
    const simulation = d3.forceSimulation(graphData.nodes)
      .force("link", d3.forceLink(graphData.links)
        .id((d: any) => d.id)
        .distance(d => {
          const link = d as any;
          return link.type === "collaboration" ? 150 : 120;
        })
        .strength(0.5))
      .force("charge", d3.forceManyBody().strength(-500))
      .force("collision", d3.forceCollide().radius((d: any) => {
        const node = d as Node;
        if (node.type === "executive") return 45;
        if (node.type === "director") return 40;
        if (node.type === "practice_lead") return 38;
        if (node.type === "team") return 35;
        return 30;
      }))
      .force("y", d3.forceY((d: any) => levelHeight * d.level).strength(0.8))
      .force("x", d3.forceX(width / 2).strength(0.05));

    // Create links
    const link = g.append("g")
      .selectAll("line")
      .data(graphData.links)
      .enter().append("line")
      .style("stroke", (d: any) => d.type === "collaboration" ? "#FFA500" : "#6BC9E0")
      .style("stroke-width", (d: any) => d.type === "collaboration" ? 3 : 2)
      .style("stroke-dasharray", (d: any) => d.type === "collaboration" ? "5,5" : "none")
      .style("stroke-opacity", 0.4)
      .style("filter", "url(#sales-glow)");

    // Create nodes
    const node = g.append("g")
      .selectAll("g")
      .data(graphData.nodes)
      .enter().append("g")
      .style("cursor", "pointer")
      .call(d3.drag<SVGGElement, Node>()
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
      .attr("r", (d: Node) => {
        if (d.type === "executive") return 33;
        if (d.type === "director") return 28;
        if (d.type === "practice_lead") return 26;
        if (d.type === "team") return 23;
        return 20;
      })
      .style("fill", (d: Node) => colorScale(d.type))
      .style("opacity", 0.2)
      .style("filter", "url(#sales-glow)");

    // Add main circles to nodes
    node.append("circle")
      .attr("r", (d: Node) => {
        if (d.type === "executive") return 25;
        if (d.type === "director") return 20;
        if (d.type === "practice_lead") return 18;
        if (d.type === "team") return 15;
        return 12;
      })
      .style("fill", (d: Node) => colorScale(d.type))
      .style("stroke", "#fff")
      .style("stroke-width", 3)
      .style("filter", "url(#sales-glow)");

    // Add labels to nodes
    node.append("text")
      .attr("dy", 4)
      .attr("text-anchor", "middle")
      .text((d: Node) => d.name.split(' ')[0]) // Show first name only for space
      .style("font-size", (d: Node) => d.type === "executive" ? "14px" : "11px")
      .style("fill", "#ffffff")
      .style("font-weight", "600")
      .style("stroke", "#000")
      .style("stroke-width", "0.5px")
      .style("paint-order", "stroke")
      .style("text-shadow", "0 2px 8px rgba(0,0,0,0.8)")
      .style("pointer-events", "none");

    // Add click handler
    node.on("click", (event, d) => {
      setSelectedNode(d);
    });

    // Add hover effects
    node.on("mouseover", function(_event, d) {
      const nodeData = d as Node;
      d3.select(this).select("circle")
        .transition()
        .duration(200)
        .attr("r", () => {
          if (nodeData.type === "executive") return 28;
          if (nodeData.type === "director") return 23;
          if (nodeData.type === "practice_lead") return 21;
          if (nodeData.type === "team") return 18;
          return 15;
        });
    })
    .on("mouseout", function(_event, d) {
      const nodeData = d as Node;
      d3.select(this).select("circle")
        .transition()
        .duration(200)
        .attr("r", () => {
          if (nodeData.type === "executive") return 25;
          if (nodeData.type === "director") return 20;
          if (nodeData.type === "practice_lead") return 18;
          if (nodeData.type === "team") return 15;
          return 12;
        });
    });

    // Simulation tick function
    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [width, height, viewMode, filterOption]);

  const handleViewModeChange = (event: any) => {
    setViewMode(event.target.value);
  };

  const handleFilterChange = (event: any) => {
    setFilterOption(event.target.value);
  };

  const resetView = () => {
    if (svgRef.current) {
      const svg = d3.select(svgRef.current);
      svg.transition().duration(750).call(
        d3.zoom<SVGSVGElement, unknown>().transform,
        d3.zoomIdentity
      );
    }
  };

  return (
    <Box sx={{ display: 'flex', height: '100%', position: 'relative' }}>
      {/* Controls */}
      <Paper
        elevation={2}
        sx={{
          position: 'absolute',
          top: 20,
          left: 20,
          p: 2,
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          zIndex: 10,
          borderRadius: 2,
        }}
      >
        <Stack spacing={2} direction="row" alignItems="center">
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>View Mode</InputLabel>
            <Select value={viewMode} onChange={handleViewModeChange} label="View Mode">
              <MenuItem value="hierarchy">Hierarchy</MenuItem>
              <MenuItem value="specialization">Specialization</MenuItem>
              <MenuItem value="region">Region</MenuItem>
              <MenuItem value="industry">Industry</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Filter</InputLabel>
            <Select value={filterOption} onChange={handleFilterChange} label="Filter">
              <MenuItem value="all">All Teams</MenuItem>
              <MenuItem value="enterprise">Enterprise</MenuItem>
              <MenuItem value="mid-market">Mid-Market</MenuItem>
              <MenuItem value="smb">SMB</MenuItem>
              <MenuItem value="technical">Technical</MenuItem>
            </Select>
          </FormControl>

          <Button
            variant="outlined"
            size="small"
            onClick={resetView}
            startIcon={<Refresh />}
          >
            Reset View
          </Button>
        </Stack>
      </Paper>

      {/* Legend */}
      <Paper
        elevation={2}
        sx={{
          position: 'absolute',
          top: 20,
          right: selectedNode ? 370 : 20,
          p: 2,
          background: 'rgba(30, 35, 50, 0.95)',
          backdropFilter: 'blur(10px)',
          zIndex: 10,
          borderRadius: 2,
          transition: 'right 0.3s ease',
          color: '#ffffff',
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
          Node Types
        </Typography>
        <Stack spacing={1}>
          {Object.entries(categoryColors).map(([type, color]) => (
            <Box key={type} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                sx={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  backgroundColor: color,
                  border: '2px solid #fff',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                }}
              />
              <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
                {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </Typography>
            </Box>
          ))}
        </Stack>
      </Paper>

      {/* Statistics */}
      <Paper
        elevation={2}
        sx={{
          position: 'absolute',
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          p: 2,
          background: 'rgba(30, 35, 50, 0.95)',
          backdropFilter: 'blur(10px)',
          zIndex: 10,
          borderRadius: 3,
          color: '#ffffff',
        }}
      >
        <Stack direction="row" spacing={4}>
          {[
            { label: 'Teams', value: stats.totalTeams, icon: <Group /> },
            { label: 'Reps', value: stats.totalReps, icon: <Person /> },
            { label: 'Specializations', value: stats.totalSpecializations, icon: <Business /> },
            { label: 'Regions', value: stats.totalRegions, icon: <TrendingUp /> },
          ].map((stat, index) => (
            <Box key={index} sx={{ textAlign: 'center' }}>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  color: 'transparent',
                }}
              >
                {stat.value}
              </Typography>
              <Typography variant="caption" sx={{ color: '#666', fontSize: '0.75rem' }}>
                {stat.label}
              </Typography>
            </Box>
          ))}
        </Stack>
      </Paper>

      {/* Main Graph */}
      <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <svg
          ref={svgRef}
          width={width}
          height={height}
          style={{ background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}
        />
      </Box>

      {/* Info Panel */}
      {selectedNode && (
        <Card
          elevation={3}
          sx={{
            position: 'absolute',
            top: 20,
            right: 20,
            width: 320,
            maxHeight: height - 40,
            overflowY: 'auto',
            background: 'rgba(30, 35, 50, 0.95)',
            backdropFilter: 'blur(10px)',
            zIndex: 20,
            color: '#ffffff',
          }}
        >
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Avatar
                sx={{
                  bgcolor: colorScale(selectedNode.type),
                  width: 48,
                  height: 48,
                  mr: 2,
                }}
              >
                {selectedNode.type === 'executive' ? <Business /> :
                 selectedNode.type === 'team' ? <Group /> : <Person />}
              </Avatar>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {selectedNode.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedNode.role}
                </Typography>
              </Box>
            </Box>

            <Divider sx={{ my: 2 }} />

            <Stack spacing={2}>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                  Type
                </Typography>
                <Chip
                  label={selectedNode.type.replace('_', ' ')}
                  size="small"
                  sx={{ backgroundColor: colorScale(selectedNode.type), color: 'white' }}
                />
              </Box>

              {selectedNode.specialization && (
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                    Specialization
                  </Typography>
                  <Typography variant="body2">{selectedNode.specialization}</Typography>
                </Box>
              )}

              {selectedNode.focus && (
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                    Focus Areas
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selectedNode.focus.map((area, index) => (
                      <Chip key={index} label={area} size="small" variant="outlined" />
                    ))}
                  </Box>
                </Box>
              )}

              {selectedNode.quota && (
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                    Annual Quota
                  </Typography>
                  <Typography variant="body2">{selectedNode.quota}</Typography>
                </Box>
              )}

              {selectedNode.accounts && (
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                    Accounts
                  </Typography>
                  <Typography variant="body2">{selectedNode.accounts}</Typography>
                </Box>
              )}

              {selectedNode.size && (
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                    Team Size
                  </Typography>
                  <Typography variant="body2">{selectedNode.size} members</Typography>
                </Box>
              )}

              {selectedNode.industries && (
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                    Industries
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selectedNode.industries.map((industry, index) => (
                      <Chip key={index} label={industry} size="small" variant="outlined" />
                    ))}
                  </Box>
                </Box>
              )}

              {selectedNode.region && (
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                    Region
                  </Typography>
                  <Typography variant="body2">{selectedNode.region}</Typography>
                </Box>
              )}
            </Stack>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default IntegratorSalesTeamsGraph;
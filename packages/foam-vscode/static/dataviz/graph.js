const CONTAINER_ID = 'graph';

/** The style fallback. These values should only be used when all else fails. */
const styleFallback = {
  background: '#202020',
  fontSize: 12,
  lineColor: '#277da1',
  lineWidth: 0.2,
  particleWidth: 1.0,
  highlightedForeground: '#f9c74f',
  node: {
    note: '#277da1',
    placeholder: '#545454',
    tag: '#f9c74f'
  },
};

function getStyle(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name);
}

const sizeScale = d3
  .scaleLinear()
  .domain([0, 30])
  .range([0.5, 2])
  .clamp(true);

const labelAlpha = d3
  .scaleLinear()
  .domain([1.2, 2])
  .range([0, 1])
  .clamp(true);

const defaultStyle = {
  background: getStyle(`--vscode-panel-background`) ?? styleFallback.background,
  fontSize:
    parseInt(getStyle(`--vscode-font-size`) ?? styleFallback.fontSize) - 2,
  lineColor: getStyle('--vscode-editor-foreground') ?? styleFallback.lineColor,
  lineWidth: parseFloat(styleFallback.lineWidth),
  particleWidth: parseFloat(styleFallback.particleWidth),
  highlightedForeground:
    getStyle('--vscode-list-highlightForeground') ??
    styleFallback.highlightedForeground,
  node: {
    note: getStyle('--vscode-editor-foreground') ?? styleFallback.node.note,
    placeholder:
      getStyle('--vscode-list-deemphasizedForeground') ??
      styleFallback.node.placeholder,
    tag: getStyle('--vscode-list-highlightForeground') ?? styleFallback.node.tag,

  },
};

let model = {
  selectedNodes: new Set(),
  hoverNode: null,
  focusNodes: new Set(),
  focusLinks: new Set(),
  fullGraphData: {},
  nodeInfo: {},
  data: {
    nodes: [],
    links: [],
  },
  /** The style property.
   * It tries to be set using VSCode values,
   * in the case it fails, use the fallback style values.
   */
  style: defaultStyle,
  view: "default",
};
const graph = ForceGraph();

function update(patch) {
  // Apply the patch function to the model..
  patch(model);
  // ..then compute the derived state

  // compute highlighted elements
  const focusNodes = new Set();
  const focusLinks = new Set();
  if (model.hoverNode) {
    focusNodes.add(model.hoverNode);
    const info = model.nodeInfo[model.hoverNode];
    info.neighbors.forEach(neighborId => focusNodes.add(neighborId));
    info.links.forEach(link => focusLinks.add(link));
  }
  if (model.selectedNodes) {
    model.selectedNodes.forEach(nodeId => {
      focusNodes.add(nodeId);
      const info = model.nodeInfo[nodeId];
      info.neighbors.forEach(neighborId => focusNodes.add(neighborId));
      info.links.forEach(link => focusLinks.add(link));
    });
  }
  model.focusNodes = focusNodes;
  model.focusLinks = focusLinks;
}

const Actions = {
  refreshWorkspaceData: graphInfo =>
    update(m => {
      m.fullGraphData = JSON.parse(JSON.stringify(graphInfo));
      patchGraphData(m,graphInfo);
    }),
  selectNode: (nodeId, isAppend) =>
    update(m => {
      if (!isAppend) {
        m.selectedNodes.clear();
      }
      if (nodeId != null) {
        m.selectedNodes.add(nodeId);
      }
    }),
  highlightNode: nodeId =>
    update(m => {
      m.hoverNode = nodeId;
    }),
  /** Applies a new style to the graph,
   * missing elements are set to their existing values.
   *
   * @param {*} newStyle the style to be applied
   */
  updateStyle: newStyle => {
    if (!newStyle) {
      return;
    }
    model.style = {
      ...defaultStyle,
      ...newStyle,
      lineColor:
        newStyle.lineColor ||
        (newStyle.node && newStyle.node.note) ||
        defaultStyle.lineColor,
      node: {
        ...defaultStyle.node,
        ...newStyle.node,
      },
    };
    graph.backgroundColor(model.style.background);
  },
  filterByType: () => {
    update(m => {
      let types = [];
      switch(model.view){
        case "default":
          types = ["note","placeholder"];
          break;
        case "tags":
          types = ["note", "placeholder", "tag"];
          break;
        case "all":
          types = "all";
          break;
      }
      const graphData = JSON.parse(JSON.stringify(model.fullGraphData));
      if(types == "all") {
        patchGraphData(m,graphData);
      } else {
        const nodes = Object.values(graphData.nodes)
          .filter(n => types.some(t => t == n.type))
          .reduce((nodesAccumulator,node) => {
            nodesAccumulator[node.id] = graphData.nodes[node.id];
            return nodesAccumulator;
        }, {});
        const links = graphData.links.filter(link => {
          const isSource = Object.values(nodes).some(node => node.id == link.source);
          const isTarget = Object.values(nodes).some(node => node.id == link.target);
          return isSource && isTarget;
        });
        patchGraphData(m,{nodes: nodes, links: links});
      }
    });
  },
};

function initDataviz(channel) {
  const elem = document.getElementById(CONTAINER_ID);
  graph(elem)
    .graphData(model.data)
    .backgroundColor(model.style.background)
    .linkHoverPrecision(8)
    .d3Force('x', d3.forceX())
    .d3Force('y', d3.forceY())
    .d3Force('collide', d3.forceCollide(graph.nodeRelSize()))
    .linkWidth(() => model.style.lineWidth || styleFallback.lineWidth)
    .linkDirectionalParticles(1)
    .linkDirectionalParticleWidth(link =>
      getLinkState(link, model) === 'highlighted'
        ? model.style.particleWidth || styleFallback.particleWidth
        : 0
    )
    .nodeCanvasObject((node, ctx, globalScale) => {
      const info = model.nodeInfo[node.id];
      if (info == null) {
        console.error(`Could not find info for node ${node.id} - skipping`);
        return;
      }
      const size = sizeScale(info.neighbors.length);
      const { fill, border } = getNodeColor(node.id, model);
      const fontSize = model.style.fontSize / globalScale;
      const nodeState = getNodeState(node.id, model);
      const textColor = fill.copy({
        opacity:
          nodeState === 'regular'
            ? labelAlpha(globalScale)
            : nodeState === 'highlighted'
            ? 1
            : Math.min(labelAlpha(globalScale), fill.opacity),
      });
      const label = info.title;

      Draw(ctx)
        .circle(node.x, node.y, size + 0.2, border)
        .circle(node.x, node.y, size, fill)
        .text(label, node.x, node.y + size + 1, fontSize, textColor.toString());
    })
    .linkColor(link => getLinkColor(link, model))
    .onNodeHover(node => {
      Actions.highlightNode(node?.id);
    })
    .onNodeClick((node, event) => {
      if (event.getModifierState('Control') || event.getModifierState('Meta')) {
        channel.postMessage({
          type: 'webviewDidSelectNode',
          payload: node.id,
        });
      }
      Actions.selectNode(node.id, event.getModifierState('Shift'));
    })
    .onBackgroundClick(event => {
      Actions.selectNode(null, event.getModifierState('Shift'));
    });
  const gui = new dat.gui.GUI();
  gui.add(model, 'view', {Default: "default", Tags: "tags", All: "all"})
    .name('View')
    .onFinishChange(function(){
      Actions.filterByType();
  });
}

function augmentGraphInfo(data) {
  Object.values(data.nodes).forEach(node => {
    node.neighbors = [];
    node.links = [];
    if(node.tags && node.tags.length > 0){
      node.tags.forEach(tag => {
        const tagNode = {
          id: tag.label,
          title: tag.label,
          type: 'tag',
          properties: {},
          neighbors: [],
          links: [],
        };
        data.nodes[tag.label] = tagNode;
        data.links.push({
          target: node.id,
          source: tagNode.id
        });
      });
    }
  });
  data.links.forEach(link => {
    const a = data.nodes[link.source];
    const b = data.nodes[link.target];
    a.neighbors.push(b.id);
    b.neighbors.push(a.id);
    a.links.push(link);
    b.links.push(link);
  });
  return data;
}

function patchGraphData(m,graphInfo) {
  m.nodeInfo = graphInfo.nodes;
  const links = graphInfo.links;

  // compute graph delta, for smooth transitions we need to mutate objects in-place
  const nodeIdsToAdd = new Set(Object.keys(m.nodeInfo));
  const nodeIdsToRemove = new Set();
  m.data.nodes.forEach(node => {
    if (nodeIdsToAdd.has(node.id)) {
      nodeIdsToAdd.delete(node.id);
    } else {
      nodeIdsToRemove.add(node.id);
    }
  });
  // apply the delta
  nodeIdsToRemove.forEach(id => {
    const index = m.data.nodes.findIndex(n => n.id == id);
    m.data.nodes.splice(index, 1); // delete the element
  });
  nodeIdsToAdd.forEach(nodeId => {
    m.data.nodes.push({
      id: nodeId,
    });
  });
  m.data.links = links; // links can be swapped out without problem

  // check that selected/hovered nodes are still valid (see #397)
  m.hoverNode = m.nodeInfo[m.hoverNode] != null ? m.hoverNode : null;
  m.selectedNodes = new Set(
    Array.from(m.selectedNodes).filter(nId => m.nodeInfo[nId] != null)
  );

  // annoying we need to call this function, but I haven't found a good workaround
  graph.graphData(m.data);
}

function getNodeColor(nodeId, model) {
  const info = model.nodeInfo[nodeId];
  const style = model.style;
  const typeFill = info.properties.color 
    ? d3.rgb(info.properties.color) 
    : d3.rgb(style.node[info.type ?? 'note'] ?? style.node['note']);
  switch (getNodeState(nodeId, model)) {
    case 'regular':
      return { fill: typeFill, border: typeFill };
    case 'lessened':
      const transparent = d3.rgb(typeFill).copy({ opacity: 0.05 });
      return { fill: transparent, border: transparent };
    case 'highlighted':
      return {
        fill: typeFill,
        border: d3.rgb(style.highlightedForeground),
      };
    default:
      throw new Error('Unknown type for node', nodeId);
  }
}

function getLinkColor(link, model) {
  const style = model.style;
  switch (getLinkState(link, model)) {
    case 'regular':
      return style.lineColor;
    case 'highlighted':
      return style.highlightedForeground;
    case 'lessened':
      return d3.hsl(style.lineColor).copy({ opacity: 0.5 });
    default:
      throw new Error('Unknown type for link', link);
  }
}

function getNodeState(nodeId, model) {
  return model.selectedNodes.has(nodeId) || model.hoverNode === nodeId
    ? 'highlighted'
    : model.focusNodes.size === 0
    ? 'regular'
    : model.focusNodes.has(nodeId)
    ? 'regular'
    : 'lessened';
}

function getLinkState(link, model) {
  return model.focusNodes.size === 0
    ? 'regular'
    : Array.from(model.focusLinks).some(fLink => fLink.source == link.source.id && fLink.target == link.target.id)
    ? 'highlighted'
    : 'lessened';
}

const Draw = ctx => ({
  circle: function(x, y, radius, color) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI, false);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.closePath();
    return this;
  },
  text: function(text, x, y, size, color) {
    ctx.font = `${size}px Sans-Serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    return this;
  },
});

// init the app
try {
  const vscode = acquireVsCodeApi();

  window.onload = () => {
    initDataviz(vscode);
    console.log('ready');
    vscode.postMessage({
      type: 'webviewDidLoad',
    });
  };

  window.addEventListener('error', error => {
    vscode.postMessage({
      type: 'error',
      payload: {
        message: error.message,
        filename: error.filename,
        lineno: error.lineno,
        colno: error.colno,
        error: error.error,
      },
    });
  });

  window.addEventListener('message', event => {
    const message = event.data;
    switch (message.type) {
      case 'didUpdateGraphData':
        graphData = augmentGraphInfo(message.payload);
        Actions.refreshWorkspaceData(graphData);
        console.log('didUpdateGraphData', graphData);
        break;
      case 'didSelectNote':
        const noteId = message.payload;
        const node = graph.graphData().nodes.find(node => node.id === noteId);
        if (node) {
          graph.centerAt(node.x, node.y, 300).zoom(3, 300);
          Actions.selectNode(noteId);
        }
        break;
      case 'didUpdateStyle':
        const style = message.payload;
        Actions.updateStyle(style);
        break;
    }
  });
} catch {
  console.log('VsCode not detected');
}

window.addEventListener('resize', () => {
  graph.width(window.innerWidth).height(window.innerHeight);
});

// For testing
if (window.data) {
  console.log('Test mode');
  window.model = model;
  window.graph = graph;
  window.onload = () => {
    initDataviz({
      postMessage: message => console.log('message', message),
    });
    const graphData = augmentGraphInfo(window.data);
    Actions.refresh(graphData);
  };
}

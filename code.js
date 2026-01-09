// GAP Audit & Token Manager - Figma Plugin
// Audits and manages the GAP (itemSpacing) value of Frames/AutoLayouts
// Allows linking GAP values to Design Tokens (Variables) for consistent spacing

// Helper: Check if node is Frame or AutoLayout
function isFrameOrAutoLayout(node) {
  return node && ['FRAME', 'COMPONENT', 'COMPONENT_SET', 'INSTANCE'].includes(node.type);
}

// Helper: Create gapInfo object with default values
function createGapInfo(node) {
  return {
    nodeId: node.id,
    nodeName: node.name,
    nodeType: node.type,
    hasAutoLayout: true,
    layoutMode: node.layoutMode,
    itemSpacing: node.itemSpacing,
    itemSpacingToken: null,
    itemSpacingTokenValue: null,
    itemSpacingTokenId: null,
    itemSpacingTokenFullPath: null,
    itemSpacingTokenCollectionPath: null
  };
}

// Helper: Get default mode ID from variable
function getDefaultModeId(variable) {
  return variable.defaultModeId || (variable.modes && variable.modes.length > 0 ? variable.modes[0].modeId : null);
}

// Helper: Get variable value for default mode
function getVariableValue(variable) {
  const modeId = getDefaultModeId(variable);
  if (modeId && variable.valuesByMode && variable.valuesByMode[modeId] !== undefined) {
    const value = variable.valuesByMode[modeId];
    return typeof value === 'number' ? value : null;
  }
  return null;
}

// Cache for variable collections to avoid repeated lookups
let variableCollectionsCache = null;

// Helper: Get all variable collections (with caching)
async function getAllVariableCollections() {
  if (variableCollectionsCache) {
    return variableCollectionsCache;
  }
  
  if (!figma.variables) {
    return [];
  }
  
  try {
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    variableCollectionsCache = collections || [];
    return variableCollectionsCache;
  } catch (e) {
    variableCollectionsCache = [];
    return [];
  }
}

// Helper: Get gap information from node (only itemSpacing/GAP)
// Logic: 1. Check Auto Layout, 2. Read itemSpacing, 3. Check if tokenized
async function getGapInfo(node) {
  // Validate node type
  if (!isFrameOrAutoLayout(node)) {
    return null;
  }

  // Step 1: Check if it has AutoLayout enabled
  // Note: node.hasAutoLayout doesn't exist, use layoutMode instead
  if (node.layoutMode === 'NONE') {
    return {
      nodeId: node.id,
      nodeName: node.name,
      nodeType: node.type,
      hasAutoLayout: false,
      itemSpacing: null,
      itemSpacingToken: null,
      itemSpacingTokenValue: null,
      error: 'El elemento seleccionado no tiene AutoLayout habilitado'
    };
  }

  // Step 2: Read itemSpacing and initialize gapInfo
  const gapInfo = createGapInfo(node);

  // Step 3: Check if boundVariables.itemSpacing exists (avoid optional chaining)
  const boundGap = node.boundVariables && node.boundVariables.itemSpacing;

  // CASO 1: GAP VINCULADO A TOKEN
  if (boundGap) {
    // Handle array or single object
    let boundAlias = null;
    if (Array.isArray(boundGap) && boundGap.length > 0) {
      boundAlias = boundGap[0];
    } else if (boundGap.type === 'VARIABLE_ALIAS') {
      boundAlias = boundGap;
    }

    if (boundAlias && boundAlias.type === 'VARIABLE_ALIAS' && boundAlias.id) {
      try {
        // Use async method for dynamic-page access
        const variable = await figma.variables.getVariableByIdAsync(boundAlias.id);

        if (!variable) {
          const errorGapInfo = createGapInfo(node);
          errorGapInfo.error = 'Variable no encontrada';
          return errorGapInfo;
        }

        // Get collection name using async method
        let collectionName = null;
        if (variable.variableCollectionId) {
          try {
            const collections = await getAllVariableCollections();
            const collection = collections.find(c => c.id === variable.variableCollectionId);
            if (collection) {
              collectionName = collection.name || null;
            }
          } catch (e) {
            // If collection lookup fails, use ID as fallback
            collectionName = variable.variableCollectionId;
          }
        }

        // Resolver valor según el mode activo
        const resolvedValue = getVariableValue(variable);

        // Build full path
        const fullPath = collectionName 
          ? `${collectionName}/${variable.name}`
          : (variable.variableCollectionId ? `${variable.variableCollectionId}/${variable.name}` : variable.name);

        // Set token information
        gapInfo.itemSpacingToken = variable.name;
        gapInfo.itemSpacingTokenValue = typeof resolvedValue === 'number' ? resolvedValue : null;
        gapInfo.itemSpacingTokenId = variable.id;
        gapInfo.itemSpacingTokenFullPath = fullPath;
        gapInfo.itemSpacingTokenCollectionPath = collectionName || variable.variableCollectionId || null;

        return gapInfo;
      } catch (e) {
        // Error resolving token - return gapInfo with error
        const errorGapInfo = createGapInfo(node);
        errorGapInfo.error = 'Error al resolver el token: ' + (e.message || e.toString());
        return errorGapInfo;
      }
    }
  }

  // CASO 2: GAP SIN TOKEN (hardcoded)
  return gapInfo;
}

// Get all available spacing tokens (FLOAT variables)
async function getAvailableTokens() {
  if (!figma.variables) return [];
  
  try {
    const variables = await figma.variables.getLocalVariablesAsync();
    return variables
      .filter(v => v.resolvedType === 'FLOAT')
      .map(v => ({
        id: v.id,
        name: v.name,
        value: getVariableValue(v)
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (e) {
    return [];
  }
}

// Scan selected nodes
async function scanSelection() {
  const selection = figma.currentPage.selection;
  
  // Validate selection
  if (selection.length === 0) {
    return {
      success: false,
      message: 'Por favor, selecciona un Frame o AutoLayout para auditar su GAP (itemSpacing)'
    };
  }

  if (selection.length > 1) {
    return {
      success: false,
      message: 'Por favor, selecciona solo un elemento a la vez'
    };
  }

  const node = selection[0];
  
  // Validate node type
  if (!isFrameOrAutoLayout(node)) {
    return {
      success: false,
      message: 'El elemento seleccionado no es un Frame o AutoLayout válido'
    };
  }

  const gapInfo = await getGapInfo(node);

  if (!gapInfo) {
    return {
      success: false,
      message: 'No se pudo obtener información del elemento seleccionado'
    };
  }

  // Check for AutoLayout requirement
  if (gapInfo.error) {
    return {
      success: false,
      message: gapInfo.error
    };
  }

  const collections = await getAllVariableCollections();
  
  return {
    success: true,
    gapInfo: gapInfo,
    availableTokens: await getAvailableTokens(),
    collections: collections.map(c => ({
      id: c.id,
      name: c.name || ''
    }))
  };
}

// Link gap to design token
async function linkGapToToken(nodeId, tokenName, gapType, tokenId, tokenValue, collectionId) {
  try {
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node || !isFrameOrAutoLayout(node)) {
      return {
        success: false,
        message: 'No se pudo encontrar el nodo seleccionado'
      };
    }

    // Validate AutoLayout
    if (node.layoutMode === 'NONE') {
      return {
        success: false,
        message: 'El elemento no tiene AutoLayout habilitado'
      };
    }

    if (!figma.variables) {
      return {
        success: false,
        message: 'La API de Variables no está disponible en tu versión de Figma'
      };
    }

    let variable = null;

    // Use existing token if ID provided
    if (tokenId) {
      try {
        variable = await figma.variables.getVariableByIdAsync(tokenId);
        if (!variable) {
          return {
            success: false,
            message: 'No se pudo encontrar el token seleccionado'
          };
        }
      } catch (e) {
        return {
          success: false,
          message: 'Error al obtener el token: ' + (e.message || e.toString())
        };
      }
    } else {
      // Find or create variable
      const variables = await figma.variables.getLocalVariablesAsync();
      variable = variables.find(v => v.name === tokenName);

      if (!variable) {
        // Determine the value to use: provided value or current gap value
        const gapValue = tokenValue !== null && tokenValue !== undefined 
          ? tokenValue 
          : (node.itemSpacing || 0);

        // Validate token name
        if (!tokenName || tokenName.trim() === '') {
          return {
            success: false,
            message: 'El nombre del token no puede estar vacío'
          };
        }

        // Verify collection exists if provided
        let validCollectionId = null;
        if (collectionId) {
          try {
            const collections = await getAllVariableCollections();
            const collection = collections.find(c => c.id === collectionId);
            if (collection) {
              validCollectionId = collectionId;
            }
          } catch (e) {
            // Collection lookup failed, continue without collection
          }
        }

        // Create new variable
        try {
          variable = figma.variables.createVariable(tokenName.trim(), 'FLOAT');
          variable.setValueForMode(variable.modes[0].modeId, gapValue);
          
          // Add to collection if specified (using addVariable method)
          if (validCollectionId) {
            try {
              const collections = await getAllVariableCollections();
              const collection = collections.find(c => c.id === validCollectionId);
              if (collection && collection.addVariable) {
                collection.addVariable(variable);
                // Clear cache after adding variable to collection
                variableCollectionsCache = null;
              }
            } catch (e) {
              // Collection assignment failed, but variable was created
            }
          }
        } catch (createError) {
          return {
            success: false,
            message: `Error al crear el token: ${createError.message}`
          };
        }
        
        // Clear cache to refresh collections
        variableCollectionsCache = null;
      }
    }

    // Apply variable to itemSpacing (GAP)
    const variableAlias = {
      type: 'VARIABLE_ALIAS',
      id: variable.id
    };

    if (gapType === 'itemSpacing' && node.layoutMode !== 'NONE') {
      node.setBoundVariable('itemSpacing', variableAlias);
      
      // Get the token value for the response
      const tokenValue = getVariableValue(variable);

      return {
        success: true,
        message: `GAP vinculado correctamente al token "${variable.name}"`,
        tokenName: variable.name,
        tokenValue: tokenValue
      };
    } else {
      return {
        success: false,
        message: 'Solo se puede vincular el itemSpacing (GAP) de elementos con AutoLayout'
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `Error: ${error.message}`
    };
  }
}

// Main plugin code
if (figma.editorType === 'figma') {
  figma.showUI(__html__, { width: 420, height: 640 });

  // Initial scan
  scanSelection().then(initialScan => {
    figma.ui.postMessage({ type: 'scan-result', data: initialScan });
  });

  // Listen for selection changes
  figma.on('selectionchange', () => {
    scanSelection().then(scanResult => {
      figma.ui.postMessage({ type: 'scan-result', data: scanResult });
    });
  });

  // Handle UI messages
  figma.ui.onmessage = (msg) => {
    if (msg.type === 'scan') {
      scanSelection().then(scanResult => {
        figma.ui.postMessage({ type: 'scan-result', data: scanResult });
      });
    } else if (msg.type === 'link-token') {
      linkGapToToken(msg.nodeId, msg.tokenName, msg.gapType, msg.tokenId, msg.tokenValue, msg.collectionId)
        .then(result => {
          figma.ui.postMessage({ type: 'link-result', data: result });
          setTimeout(() => {
            scanSelection().then(scanResult => {
              figma.ui.postMessage({ type: 'scan-result', data: scanResult });
            });
          }, 100);
        })
        .catch(error => {
          figma.ui.postMessage({
            type: 'link-result',
            data: {
              success: false,
              message: `Error: ${error.message}`
            }
          });
        });
    } else if (msg.type === 'cancel') {
      figma.closePlugin();
    }
  };
} else {
  figma.notify('Este plugin solo funciona en Figma');
  figma.closePlugin();
}

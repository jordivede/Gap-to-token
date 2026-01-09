// GAP Audit & Token Manager - Figma Plugin
// Audits and manages the GAP (itemSpacing) value of Frames/AutoLayouts
// Allows linking GAP values to Design Tokens (Variables) for consistent spacing

// Helper: Check if node is Frame or AutoLayout
function isFrameOrAutoLayout(node) {
  return ['FRAME', 'COMPONENT', 'COMPONENT_SET', 'INSTANCE'].includes(node.type);
}

// Cache for variable collections to avoid repeated lookups
let variableCollectionsCache = null;

// Helper: Get all variable collections (with caching)
async function getAllVariableCollections() {
  try {
    if (variableCollectionsCache) {
      return variableCollectionsCache;
    }
    
    if (!figma.variables) {
      return [];
    }
    
    // Try to get collections - they might not be available in all Figma versions
    try {
      const collections = await figma.variables.getLocalVariableCollectionsAsync();
      variableCollectionsCache = collections || [];
      return variableCollectionsCache;
    } catch (e) {
      console.log('getLocalVariableCollectionsAsync not available, trying alternative:', e);
      // Fallback: return empty array if method doesn't exist
      variableCollectionsCache = [];
      return [];
    }
  } catch (e) {
    console.log('Error getting variable collections:', e);
    return [];
  }
}

// Helper: Build variable collection path
async function getVariableCollectionPath(variable) {
  try {
    // Check if variable has a collection
    if (variable.variableCollectionId) {
      const collections = await getAllVariableCollections();
      const collection = collections.find(c => c.id === variable.variableCollectionId);
      
      if (collection) {
        // Get the collection name - this is like "Section" or "Level 1"
        return collection.name || '';
      }
      
      // Fallback: try direct method if available
      try {
        const directCollection = figma.variables.getVariableCollectionById(variable.variableCollectionId);
        if (directCollection) {
          return directCollection.name || '';
        }
      } catch (e) {
        // Method not available, continue
      }
    }
  } catch (e) {
    console.log('Error getting collection path:', e);
  }
  return '';
}

// Helper: Get full variable display path (like "Section/Level 1/Between elements vertical")
async function getVariableFullPath(variable) {
  try {
    const collectionPath = await getVariableCollectionPath(variable);
    const variableName = variable.name || '';
    
    if (collectionPath && collectionPath.trim() !== '') {
      return `${collectionPath}/${variableName}`;
    }
    return variableName;
  } catch (e) {
    console.log('Error getting full path:', e);
    return variable.name || '';
  }
}

// Helper: Get variable name and value from ID (with collection path)
async function getVariableInfo(variableId) {
  try {
    if (!figma.variables) {
      console.log('Variables API not available');
      return { name: null, value: null, fullPath: null, collectionPath: null };
    }
    
    const variable = figma.variables.getVariableById(variableId);
    if (!variable) {
      console.log('Variable not found for ID:', variableId);
      return { name: null, value: null, fullPath: null, collectionPath: null };
    }
    
    let value = null;
    // Get value from first available mode
    if (variable.modes && variable.modes.length > 0) {
      const modeId = variable.modes[0].modeId;
      try {
        value = variable.getValueForMode(modeId);
      } catch (e) {
        try {
          // Try accessing valuesByMode directly
          if (variable.valuesByMode && variable.valuesByMode[modeId] !== undefined) {
            value = variable.valuesByMode[modeId];
          }
        } catch (e2) {
          console.log('Error getting variable value:', e2);
        }
      }
    }
    
    const collectionPath = await getVariableCollectionPath(variable);
    const fullPath = await getVariableFullPath(variable);
    
    const result = {
      name: variable.name || null,
      value: typeof value === 'number' ? value : null,
      fullPath: fullPath || variable.name || null,
      collectionPath: collectionPath || null,
      variableId: variableId
    };
    
    console.log('Variable info retrieved:', result);
    return result;
  } catch (e) {
    console.error('Error in getVariableInfo:', e);
    return { name: null, value: null, fullPath: null, collectionPath: null };
  }
}

// Helper: Check if property is bound to variable using boundVariables
async function getBoundVariableInfo(node, propertyName) {
  try {
    // Use boundVariables property (newer API approach)
    const bound = node.boundVariables && node.boundVariables[propertyName];
    
    if (bound && bound.length > 0) {
      // bound is an array, get the first item
      const boundAlias = bound[0];
      
      if (boundAlias && boundAlias.type === 'VARIABLE_ALIAS' && boundAlias.id) {
        console.log(`Bound variable found for ${propertyName}:`, boundAlias);
        
        try {
          const v = await figma.variables.getVariableById(boundAlias.id);
          
          if (v) {
            // Get value from default mode
            let tokenValue = null;
            if (v.defaultModeId && v.valuesByMode) {
              tokenValue = v.valuesByMode[v.defaultModeId];
            } else if (v.modes && v.modes.length > 0 && v.valuesByMode) {
              // Fallback to first mode
              tokenValue = v.valuesByMode[v.modes[0].modeId];
            }
            
            // Get collection path
            let collectionPath = '';
            let fullPath = v.name || '';
            
            if (v.variableCollectionId) {
              try {
                const collections = await getAllVariableCollections();
                const collection = collections.find(c => c.id === v.variableCollectionId);
                if (collection) {
                  collectionPath = collection.name || '';
                  fullPath = `${collectionPath}/${v.name}`;
                } else {
                  // Try direct method if available
                  try {
                    const directCollection = figma.variables.getVariableCollectionById(v.variableCollectionId);
                    if (directCollection) {
                      collectionPath = directCollection.name || '';
                      fullPath = `${collectionPath}/${v.name}`;
                    }
                  } catch (e) {
                    // Use collection ID if name not available
                    collectionPath = v.variableCollectionId;
                    fullPath = `${v.variableCollectionId}/${v.name}`;
                  }
                }
              } catch (e) {
                console.log('Error getting collection:', e);
                // Fallback: use collection ID
                collectionPath = v.variableCollectionId;
                fullPath = `${v.variableCollectionId}/${v.name}`;
              }
            }
            
            const result = {
              isBound: true,
              variableId: boundAlias.id,
              variableName: v.name || null,
              variableValue: typeof tokenValue === 'number' ? tokenValue : null,
              variableFullPath: fullPath || v.name || null,
              variableCollectionPath: collectionPath || null
            };
            
            console.log(`Variable info retrieved successfully for ${propertyName}:`, result);
            return result;
          }
        } catch (e) {
          console.error(`Error getting variable by ID ${boundAlias.id}:`, e);
        }
      }
    } else {
      console.log(`No bound variable found for ${propertyName}`);
    }
  } catch (e) {
    // Log error for debugging but return unbound
    console.error('Error checking bound variable:', e);
  }
  
  return { 
    isBound: false, 
    variableId: null, 
    variableName: null, 
    variableValue: null,
    variableFullPath: null,
    variableCollectionPath: null
  };
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

  // Step 2: Read itemSpacing
  const gapValue = node.itemSpacing;

  // Initialize gapInfo with basic information
  const gapInfo = {
    nodeId: node.id,
    nodeName: node.name,
    nodeType: node.type,
    hasAutoLayout: true,
    layoutMode: node.layoutMode,
    itemSpacing: gapValue,
    itemSpacingToken: null,
    itemSpacingTokenValue: null,
    itemSpacingTokenId: null,
    itemSpacingTokenFullPath: null,
    itemSpacingTokenCollectionPath: null
  };

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
          return {
            nodeId: gapInfo.nodeId,
            nodeName: gapInfo.nodeName,
            nodeType: gapInfo.nodeType,
            hasAutoLayout: gapInfo.hasAutoLayout,
            layoutMode: gapInfo.layoutMode,
            itemSpacing: gapInfo.itemSpacing,
            itemSpacingToken: gapInfo.itemSpacingToken,
            itemSpacingTokenValue: gapInfo.itemSpacingTokenValue,
            itemSpacingTokenId: gapInfo.itemSpacingTokenId,
            itemSpacingTokenFullPath: gapInfo.itemSpacingTokenFullPath,
            itemSpacingTokenCollectionPath: gapInfo.itemSpacingTokenCollectionPath,
            error: 'Variable no encontrada'
          };
        }

        // Get collection using async method
        let collection = null;
        let collectionName = null;
        
        if (variable.variableCollectionId) {
          try {
            // Try async method first
            const collections = await getAllVariableCollections();
            collection = collections.find(c => c.id === variable.variableCollectionId);
            if (collection) {
              collectionName = collection.name || null;
            }
          } catch (e) {
            // If async method fails, collection name will remain null
            console.log('Error getting collection:', e);
          }
        }

        // Resolver valor según el mode activo
        let resolvedValue = null;
        const modeId = collection && collection.defaultModeId 
          ? collection.defaultModeId 
          : (variable.defaultModeId || (variable.modes && variable.modes.length > 0 ? variable.modes[0].modeId : null));
        
        if (modeId && variable.valuesByMode && variable.valuesByMode[modeId] !== undefined) {
          resolvedValue = variable.valuesByMode[modeId];
        }

        // Build full path
        let fullPath = variable.name || '';
        if (collectionName) {
          fullPath = `${collectionName}/${variable.name}`;
        } else if (variable.variableCollectionId) {
          fullPath = `${variable.variableCollectionId}/${variable.name}`;
        }

        // Set token information
        gapInfo.itemSpacingToken = variable.name || null;
        gapInfo.itemSpacingTokenValue = typeof resolvedValue === 'number' ? resolvedValue : null;
        gapInfo.itemSpacingTokenId = variable.id || null;
        gapInfo.itemSpacingTokenFullPath = fullPath || variable.name || null;
        gapInfo.itemSpacingTokenCollectionPath = collectionName || variable.variableCollectionId || null;

        return gapInfo;
      } catch (e) {
        // Error resolving token
        console.error('Error resolving token:', e);
        return {
          nodeId: gapInfo.nodeId,
          nodeName: gapInfo.nodeName,
          nodeType: gapInfo.nodeType,
          hasAutoLayout: gapInfo.hasAutoLayout,
          layoutMode: gapInfo.layoutMode,
          itemSpacing: gapInfo.itemSpacing,
          itemSpacingToken: gapInfo.itemSpacingToken,
          itemSpacingTokenValue: gapInfo.itemSpacingTokenValue,
          itemSpacingTokenId: gapInfo.itemSpacingTokenId,
          itemSpacingTokenFullPath: gapInfo.itemSpacingTokenFullPath,
          itemSpacingTokenCollectionPath: gapInfo.itemSpacingTokenCollectionPath,
          error: 'Error al resolver el token: ' + (e.message || e.toString())
        };
      }
    }
  }

  // CASO 2: GAP SIN TOKEN (hardcoded)
  return gapInfo;
}

// Get all available spacing tokens (FLOAT variables)
async function getAvailableTokens() {
  try {
    if (!figma.variables) return [];
    const variables = await figma.variables.getLocalVariablesAsync();
    return variables
      .filter(v => v.resolvedType === 'FLOAT')
      .map(v => {
        let value = null;
        // Get value from first available mode
        if (v.modes && v.modes.length > 0) {
          const modeId = v.modes[0].modeId;
          try {
            value = v.getValueForMode(modeId);
          } catch (e) {
            try {
              if (v.valuesByMode && v.valuesByMode[modeId] !== undefined) {
                value = v.valuesByMode[modeId];
              }
            } catch (e2) {
              // If both fail, value remains null
            }
          }
        }
        return { 
          id: v.id, 
          name: v.name,
          value: typeof value === 'number' ? value : null
        };
      })
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

  const result = {
    success: true,
    gapInfo: gapInfo,
    availableTokens: await getAvailableTokens()
  };
  
  // Debug: Log the result
  console.log('Scan result:', {
    itemSpacing: gapInfo.itemSpacing,
    itemSpacingToken: gapInfo.itemSpacingToken,
    itemSpacingTokenValue: gapInfo.itemSpacingTokenValue,
    itemSpacingTokenId: gapInfo.itemSpacingTokenId,
    itemSpacingTokenFullPath: gapInfo.itemSpacingTokenFullPath,
    itemSpacingTokenCollectionPath: gapInfo.itemSpacingTokenCollectionPath
  });
  
  return result;
}

// Link gap to design token
async function linkGapToToken(nodeId, tokenName, gapType, tokenId, tokenValue) {
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
      variable = figma.variables.getVariableById(tokenId);
      if (!variable) {
        return {
          success: false,
          message: 'No se pudo encontrar el token seleccionado'
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

        // Create new variable
        try {
          variable = figma.variables.createVariable(tokenName.trim(), 'FLOAT');
          variable.setValueForMode(variable.modes[0].modeId, gapValue);
        } catch (createError) {
          return {
            success: false,
            message: `Error al crear el token: ${createError.message}`
          };
        }
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
      let tokenValue = null;
      if (variable.modes && variable.modes.length > 0) {
        try {
          tokenValue = variable.getValueForMode(variable.modes[0].modeId);
        } catch (e) {
          if (variable.valuesByMode) {
            tokenValue = variable.valuesByMode[variable.modes[0].modeId];
          }
        }
      }

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
      linkGapToToken(msg.nodeId, msg.tokenName, msg.gapType, msg.tokenId, msg.tokenValue)
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

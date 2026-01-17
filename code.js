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
  // Try multiple methods to get the value
  try {
    // Method 1: Try getValueForMode if available
    if (variable.getValueForMode && variable.modes && variable.modes.length > 0) {
      try {
        const modeId = variable.modes[0].modeId;
        const value = variable.getValueForMode(modeId);
        if (typeof value === 'number') {
          return value;
        }
      } catch (e) {
        // Method 1 failed, try next
      }
    }
    
    // Method 2: Use valuesByMode directly
    const modeId = getDefaultModeId(variable);
    if (modeId && variable.valuesByMode) {
      const value = variable.valuesByMode[modeId];
      if (value !== undefined && value !== null && typeof value === 'number') {
        return value;
      }
    }
    
    // Method 3: Try first available mode
    if (variable.modes && variable.modes.length > 0 && variable.valuesByMode) {
      for (let i = 0; i < variable.modes.length; i++) {
        const modeId = variable.modes[i].modeId;
        const value = variable.valuesByMode[modeId];
        if (value !== undefined && value !== null && typeof value === 'number') {
          return value;
        }
      }
    }
  } catch (e) {
    // All methods failed
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

// Helper: Get variable value for active mode of its collection
async function getVariableValueForActiveMode(variable) {
  try {
    // Get the collection to find the active mode
    // Use the same logic as when setting the value to ensure consistency
    if (variable.variableCollectionId) {
      const collections = await getAllVariableCollections();
      const collection = collections.find(c => c.id === variable.variableCollectionId);
      
      if (collection) {
        // Get the active mode ID using the same logic as when setting
        // Prefer defaultModeId, then first mode (same as when we set the value)
        let activeModeId = null;
        if (collection.defaultModeId) {
          activeModeId = collection.defaultModeId;
        } else if (collection.modes && collection.modes.length > 0) {
          activeModeId = collection.modes[0].modeId;
        }
        
        // If we have an active mode, get the value for that mode
        if (activeModeId) {
          // Try getValueForMode first (most reliable)
          if (variable.getValueForMode) {
            try {
              const value = variable.getValueForMode(activeModeId);
              if (typeof value === 'number' && !isNaN(value)) {
                return value;
              }
            } catch (e) {
              // Error reading value, continue to fallback
            }
          }
          
          // Fallback: try valuesByMode
          if (variable.valuesByMode && variable.valuesByMode[activeModeId] !== undefined) {
            const value = variable.valuesByMode[activeModeId];
            if (typeof value === 'number' && !isNaN(value)) {
              return value;
            }
          }
        }
      }
    }
    
    // Fallback to default mode if active mode not found
    return getVariableValue(variable);
  } catch (e) {
    // Error getting active mode value, fallback to default
    return getVariableValue(variable);
  }
}

// Get all available spacing tokens (FLOAT variables)
async function getAvailableTokens() {
  if (!figma.variables) return [];
  
  try {
    const variables = await figma.variables.getLocalVariablesAsync();
    const tokens = [];
    const collections = await getAllVariableCollections();
    
    for (let i = 0; i < variables.length; i++) {
      const v = variables[i];
      
      // Only process FLOAT variables
      if (v.resolvedType !== 'FLOAT') continue;
      
      // Get value for active mode of the collection
      let value = null;
      let aliasInfo = null;
      
      // Try to get value from active mode of collection
      if (v.variableCollectionId) {
        const collection = collections.find(c => c.id === v.variableCollectionId);
        if (collection) {
          // Get active mode ID - try defaultModeId first, then first mode
          let activeModeId = collection.defaultModeId || null;
          
          if (!activeModeId && collection.modes && collection.modes.length > 0) {
            // Use first mode as active mode (typically the active one)
            activeModeId = collection.modes[0].modeId;
          }
          
          // If we have an active mode, get the value for that mode
          if (activeModeId) {
            
            // Try valuesByMode first (most reliable)
            if (v.valuesByMode && v.valuesByMode[activeModeId] !== undefined) {
              const modeValue = v.valuesByMode[activeModeId];
              if (typeof modeValue === 'number' && !isNaN(modeValue)) {
                value = modeValue;
              } else if (modeValue && typeof modeValue === 'object' && modeValue.type === 'VARIABLE_ALIAS') {
                // Value is an alias to another variable
                aliasInfo = {
                  type: 'alias',
                  variableId: modeValue.id,
                  modeId: activeModeId
                };
              }
            }
            
            // Fallback: try getValueForMode
            if ((value === null || value === undefined) && !aliasInfo && v.getValueForMode) {
              try {
                const modeValue = v.getValueForMode(activeModeId);
                if (typeof modeValue === 'number' && !isNaN(modeValue)) {
                  value = modeValue;
                } else if (modeValue && typeof modeValue === 'object' && modeValue.type === 'VARIABLE_ALIAS') {
                  // Value is an alias to another variable
                  aliasInfo = {
                    type: 'alias',
                    variableId: modeValue.id,
                    modeId: activeModeId
                  };
                }
              } catch (e) {
                // getValueForMode failed
              }
            }
            
            // If we detected an alias, resolve the referenced variable
            if (aliasInfo && aliasInfo.variableId) {
              try {
                const aliasVariable = await figma.variables.getVariableByIdAsync(aliasInfo.variableId);
                if (aliasVariable) {
                  // Get value from the referenced variable
                  const referencedValue = getVariableValue(aliasVariable);
                  
                  // Get collection name for referenced variable
                  let referencedCollectionName = null;
                  if (aliasVariable.variableCollectionId) {
                    const referencedCollection = collections.find(c => c.id === aliasVariable.variableCollectionId);
                    if (referencedCollection) {
                      referencedCollectionName = referencedCollection.name || null;
                    }
                  }
                  
                  aliasInfo.variableName = aliasVariable.name;
                  aliasInfo.variableValue = typeof referencedValue === 'number' ? referencedValue : null;
                  aliasInfo.variableCollectionName = referencedCollectionName;
                  
                  // Use the referenced variable's value for display
                  value = typeof referencedValue === 'number' ? referencedValue : null;
                }
              } catch (e) {
                // Failed to resolve alias variable
                aliasInfo.variableName = null;
                aliasInfo.error = 'No se pudo resolver la variable referenciada';
              }
            }
          }
        }
      }
      
      // If still no value, try default mode as fallback
      if (value === null || value === undefined) {
        value = getVariableValue(v);
      }
      
      // Only add if value is a valid number
      const numericValue = (value !== null && value !== undefined && typeof value === 'number' && !isNaN(value)) ? value : null;
      
      // Get collection name for this variable
      let collectionName = null;
      if (v.variableCollectionId) {
        const collection = collections.find(c => c.id === v.variableCollectionId);
        if (collection) {
          collectionName = collection.name || null;
        }
      }
      
      tokens.push({
        id: v.id,
        name: v.name,
        value: numericValue,
        collectionId: v.variableCollectionId || null,
        collectionName: collectionName,
        aliasInfo: aliasInfo || null
      });
    }
    
    return tokens.sort((a, b) => a.name.localeCompare(b.name));
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
        // tokenValue comes from the UI input field "Gap"
        // tokenValue should be a valid number (can be 0 or positive)
        // IMPORTANT: tokenValue is the value the user typed in the input field
        let gapValue = null;
        
        // Convert tokenValue to number if it's a string (postMessage might serialize it)
        let numericTokenValue = null;
        if (tokenValue !== null && tokenValue !== undefined) {
          if (typeof tokenValue === 'number') {
            numericTokenValue = tokenValue;
          } else if (typeof tokenValue === 'string') {
            // Parse string to number
            const parsed = parseFloat(tokenValue);
            if (!isNaN(parsed) && isFinite(parsed)) {
              numericTokenValue = parsed;
            }
          }
        }
        
        // Check if we have a valid numeric value
        if (numericTokenValue !== null && numericTokenValue !== undefined && typeof numericTokenValue === 'number' && !isNaN(numericTokenValue) && isFinite(numericTokenValue)) {
          // Use the value from the input field (this is the Gap value)
          gapValue = numericTokenValue;
        } else {
          // Fallback to current itemSpacing only if tokenValue is truly invalid
          gapValue = (node.itemSpacing !== null && node.itemSpacing !== undefined) ? node.itemSpacing : 0;
        }

        // Validate token name
        if (!tokenName || tokenName.trim() === '') {
          return {
            success: false,
            message: 'El nombre del token no puede estar vacío'
          };
        }

        // Verify collection exists if provided and get active mode
        // In incremental mode, we need to ensure we have the actual collection node
        // Clear cache first to get fresh collection objects
        variableCollectionsCache = null;
        let collectionNode = null;
        let activeModeId = null;
        if (collectionId) {
          try {
            // Get fresh collection objects from API (these should be proper VariableCollection nodes)
            const collections = await getAllVariableCollections();
            if (collections && collections.length > 0) {
              collectionNode = collections.find(function(c) {
                return c && c.id === collectionId;
              });
            }
            
            if (collectionNode) {
              // Verify it's a valid collection node
              if (collectionNode.type && collectionNode.type !== 'VARIABLE_COLLECTION') {
                // Not a valid collection, set to null
                collectionNode = null;
              } else {
                // Get the default mode from collection (this is the mode where values are typically set)
                // Prefer defaultModeId, fallback to first mode if defaultModeId doesn't exist
                if (collectionNode.defaultModeId) {
                  activeModeId = collectionNode.defaultModeId;
                } else if (collectionNode.modes && collectionNode.modes.length > 0) {
                  activeModeId = collectionNode.modes[0].modeId;
                } else {
                  activeModeId = null;
                }
              }
            }
          } catch (e) {
            // Collection lookup failed, continue without collection
            collectionNode = null;
          }
        }

        // Create new variable
        try {
          // In incremental mode, createVariable accepts the collection as a parameter directly
          // Signature: createVariable(name, collection, type) when collection is provided
          // Signature: createVariable(name, type) when no collection is provided
          if (collectionNode) {
            // Create variable with collection passed directly as parameter (not as ID)
            // This ensures the variable is created in the collection from the start in incremental mode
            variable = figma.variables.createVariable(tokenName.trim(), collectionNode, 'FLOAT');
            
            // Clear cache after creating variable in collection
            variableCollectionsCache = null;
            
            // IMPORTANT: Use collection's modes directly since variable.modes might not be immediately available
            // after creating the variable. The variable inherits the collection's modes, so we can use collection's mode IDs
            if (collectionNode && collectionNode.modes && collectionNode.modes.length > 0) {
              // Determine which mode to use - use collection's defaultModeId or first mode
              // This should match what getVariableValueForActiveMode will use to read
              let modeIdToUse = null;
              
              // Use collection's defaultModeId or first mode (same logic as when reading)
              if (collectionNode.defaultModeId) {
                modeIdToUse = collectionNode.defaultModeId;
              } else {
                modeIdToUse = collectionNode.modes[0].modeId;
              }
              
              // Set the value in the determined mode
              // The gapValue comes from the user input in the campo "Gap"
              // Verify gapValue is valid before setting
              if (gapValue !== null && gapValue !== undefined && typeof gapValue === 'number' && !isNaN(gapValue) && isFinite(gapValue) && modeIdToUse) {
                // Set value in the primary mode using the mode ID from the collection
                variable.setValueForMode(modeIdToUse, gapValue);
                
                // Verify the value was set correctly immediately after setting
                try {
                  let verifyValue = null;
                  if (variable.getValueForMode) {
                    verifyValue = variable.getValueForMode(modeIdToUse);
                  } else if (variable.valuesByMode && variable.valuesByMode[modeIdToUse] !== undefined) {
                    verifyValue = variable.valuesByMode[modeIdToUse];
                  }
                  
                  // If value is still 0 or null (and gapValue is not 0), try setting again
                  if ((verifyValue === null || verifyValue === undefined || verifyValue === 0) && gapValue !== 0) {
                    // Set value in all collection modes as fallback
                    for (let i = 0; i < collectionNode.modes.length; i++) {
                      const collectionModeId = collectionNode.modes[i].modeId;
                      if (collectionModeId) {
                        variable.setValueForMode(collectionModeId, gapValue);
                      }
                    }
                  }
                } catch (e) {
                  // Set value in all collection modes as fallback
                  for (let i = 0; i < collectionNode.modes.length; i++) {
                    const collectionModeId = collectionNode.modes[i].modeId;
                    if (collectionModeId) {
                      variable.setValueForMode(collectionModeId, gapValue);
                    }
                  }
                }
                
                // Also set the value in all other collection modes to ensure it's available everywhere
                for (let i = 0; i < collectionNode.modes.length; i++) {
                  const otherModeId = collectionNode.modes[i].modeId;
                  if (otherModeId && otherModeId !== modeIdToUse) {
                    variable.setValueForMode(otherModeId, gapValue);
                  }
                }
              }
            }
          } else {
            // No collection specified, create variable without collection
            variable = figma.variables.createVariable(tokenName.trim(), 'FLOAT');
            
            // Use variable's default mode
            // Ensure gapValue is a valid number before setting it
            if (variable.modes && variable.modes.length > 0 && gapValue !== null && gapValue !== undefined && typeof gapValue === 'number' && !isNaN(gapValue) && isFinite(gapValue)) {
              const modeId = variable.modes[0].modeId;
              variable.setValueForMode(modeId, gapValue);
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
      // Try to get value from the variable using the active mode
      let tokenValue = null;
      
      // Try getVariableValueForActiveMode first (more reliable for collection variables)
      if (variable.variableCollectionId) {
        try {
          tokenValue = await getVariableValueForActiveMode(variable);
        } catch (e) {
          // Fallback to getVariableValue if getVariableValueForActiveMode fails
          tokenValue = getVariableValue(variable);
        }
      } else {
        // For variables without collection, use standard method
        tokenValue = getVariableValue(variable);
      }
      
      // If we still don't have a value, try to get it from the first mode
      if (tokenValue === null || tokenValue === undefined) {
        if (variable.modes && variable.modes.length > 0) {
          const firstModeId = variable.modes[0].modeId;
          if (variable.getValueForMode) {
            try {
              tokenValue = variable.getValueForMode(firstModeId);
            } catch (e) {
              // Error reading value
            }
          }
          if ((tokenValue === null || tokenValue === undefined) && variable.valuesByMode) {
            tokenValue = variable.valuesByMode[firstModeId];
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
    } else if (msg.type === 'change-viewport') {
      // Define viewport widths
      const viewportWidths = {
        'S': 375,
        'M': 500,
        'L': 750
      };
      
      const width = viewportWidths[msg.viewport] || 750;
      
      // Resize UI to the selected viewport width
      // Keep the same height
      figma.ui.resize(width, 640);
      
      // Notify UI that viewport has changed
      figma.ui.postMessage({ 
        type: 'viewport-changed', 
        viewport: msg.viewport 
      });
    }
  };
} else {
  figma.notify('Este plugin solo funciona en Figma');
  figma.closePlugin();
}

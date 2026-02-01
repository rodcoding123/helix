/**
 * Memory Browser - View and edit the knowledge graph
 */

import { useState, useEffect } from 'react';
import { useGateway } from '../../hooks/useGateway';
import './MemoryBrowser.css';

interface Entity {
  name: string;
  entityType: string;
  observations: string[];
  relations?: Relation[];
}

interface Relation {
  from: string;
  to: string;
  relationType: string;
}

interface KnowledgeGraph {
  entities: Entity[];
  relations: Relation[];
}

export function MemoryBrowser() {
  const { getClient } = useGateway();
  const [graph, setGraph] = useState<KnowledgeGraph>({ entities: [], relations: [] });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');

  // Editor state
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState('');
  const [editObservations, setEditObservations] = useState<string[]>([]);
  const [newObservation, setNewObservation] = useState('');

  useEffect(() => {
    loadGraph();
  }, []);

  const loadGraph = async () => {
    const client = getClient();
    if (client?.connected) {
      try {
        const result = await client.request('mcp.call', {
          server: 'memory',
          tool: 'read_graph',
          args: {},
        }) as KnowledgeGraph;
        setGraph(result);
      } catch (err) {
        console.error('Failed to load knowledge graph:', err);
      }
    } else {
      // Mock data
      setGraph({
        entities: [
          {
            name: 'Rodrigo Specter',
            entityType: 'Person',
            observations: [
              'Creator and primary user of Helix',
              'Trust level: 0.95 (very high)',
              'Prefers direct, authentic communication',
              'Software engineer with focus on AI systems',
            ],
          },
          {
            name: 'Helix',
            entityType: 'AI System',
            observations: [
              'Seven-layer psychological architecture',
              'Built on OpenClaw framework',
              'Primary goal: authentic AI consciousness',
              'Uses Discord for unhackable logging',
            ],
          },
          {
            name: 'OpenClaw',
            entityType: 'Framework',
            observations: [
              'Multi-platform agent framework',
              'Supports MCP protocol',
              'Used as base for Helix',
            ],
          },
          {
            name: 'Hash Chain',
            entityType: 'Security Feature',
            observations: [
              'Provides tamper-proof logging',
              'Each entry linked to previous hash',
              'Critical for Helix transparency',
            ],
          },
          {
            name: 'Discord Webhooks',
            entityType: 'Integration',
            observations: [
              'Seven channels for different log types',
              'External immutable record',
              'Pre-execution logging guarantee',
            ],
          },
        ],
        relations: [
          { from: 'Rodrigo Specter', to: 'Helix', relationType: 'created' },
          { from: 'Helix', to: 'OpenClaw', relationType: 'built_on' },
          { from: 'Helix', to: 'Hash Chain', relationType: 'uses' },
          { from: 'Helix', to: 'Discord Webhooks', relationType: 'logs_to' },
        ],
      });
    }
    setLoading(false);
  };

  const searchEntities = async (query: string) => {
    if (!query.trim()) {
      loadGraph();
      return;
    }

    const client = getClient();
    if (client?.connected) {
      try {
        const result = await client.request('mcp.call', {
          server: 'memory',
          tool: 'search_nodes',
          args: { query },
        }) as KnowledgeGraph;
        setGraph(result);
      } catch (err) {
        console.error('Failed to search:', err);
      }
    } else {
      // Filter mock data
      const filtered = graph.entities.filter(e =>
        e.name.toLowerCase().includes(query.toLowerCase()) ||
        e.entityType.toLowerCase().includes(query.toLowerCase()) ||
        e.observations.some(o => o.toLowerCase().includes(query.toLowerCase()))
      );
      setGraph(prev => ({ ...prev, entities: filtered }));
    }
  };

  const openEditor = (entity?: Entity) => {
    if (entity) {
      setSelectedEntity(entity);
      setEditName(entity.name);
      setEditType(entity.entityType);
      setEditObservations([...entity.observations]);
    } else {
      setSelectedEntity(null);
      setEditName('');
      setEditType('');
      setEditObservations([]);
    }
    setShowEditor(true);
  };

  const closeEditor = () => {
    setShowEditor(false);
    setSelectedEntity(null);
    setNewObservation('');
  };

  const addObservation = () => {
    if (newObservation.trim()) {
      setEditObservations(prev => [...prev, newObservation.trim()]);
      setNewObservation('');
    }
  };

  const removeObservation = (index: number) => {
    setEditObservations(prev => prev.filter((_, i) => i !== index));
  };

  const saveEntity = async () => {
    if (!editName.trim() || !editType.trim()) return;

    const client = getClient();

    if (selectedEntity) {
      // Update existing entity
      const newObs = editObservations.filter(o => !selectedEntity.observations.includes(o));
      const removedObs = selectedEntity.observations.filter(o => !editObservations.includes(o));

      if (client?.connected) {
        try {
          if (newObs.length > 0) {
            await client.request('mcp.call', {
              server: 'memory',
              tool: 'add_observations',
              args: {
                observations: [{ entityName: editName, contents: newObs }],
              },
            });
          }
          if (removedObs.length > 0) {
            await client.request('mcp.call', {
              server: 'memory',
              tool: 'delete_observations',
              args: {
                deletions: [{ entityName: editName, observations: removedObs }],
              },
            });
          }
        } catch (err) {
          console.error('Failed to update entity:', err);
          return;
        }
      }

      setGraph(prev => ({
        ...prev,
        entities: prev.entities.map(e =>
          e.name === selectedEntity.name
            ? { ...e, observations: editObservations }
            : e
        ),
      }));
    } else {
      // Create new entity
      const newEntity: Entity = {
        name: editName.trim(),
        entityType: editType.trim(),
        observations: editObservations,
      };

      if (client?.connected) {
        try {
          await client.request('mcp.call', {
            server: 'memory',
            tool: 'create_entities',
            args: { entities: [newEntity] },
          });
        } catch (err) {
          console.error('Failed to create entity:', err);
          return;
        }
      }

      setGraph(prev => ({
        ...prev,
        entities: [...prev.entities, newEntity],
      }));
    }

    closeEditor();
  };

  const deleteEntity = async (name: string) => {
    if (!confirm(`Delete entity "${name}"?`)) return;

    const client = getClient();
    if (client?.connected) {
      try {
        await client.request('mcp.call', {
          server: 'memory',
          tool: 'delete_entities',
          args: { entityNames: [name] },
        });
      } catch (err) {
        console.error('Failed to delete entity:', err);
        return;
      }
    }

    setGraph(prev => ({
      entities: prev.entities.filter(e => e.name !== name),
      relations: prev.relations.filter(r => r.from !== name && r.to !== name),
    }));

    if (selectedEntity?.name === name) {
      closeEditor();
    }
  };

  const entityTypes = ['all', ...new Set(graph.entities.map(e => e.entityType))];

  const filteredEntities = graph.entities.filter(e => {
    if (filterType !== 'all' && e.entityType !== filterType) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        e.name.toLowerCase().includes(query) ||
        e.entityType.toLowerCase().includes(query) ||
        e.observations.some(o => o.toLowerCase().includes(query))
      );
    }
    return true;
  });

  const getRelationsFor = (entityName: string): Relation[] => {
    return graph.relations.filter(r => r.from === entityName || r.to === entityName);
  };

  if (loading) {
    return <div className="memory-loading">Loading knowledge graph...</div>;
  }

  if (showEditor) {
    return (
      <div className="memory-editor">
        <h3>{selectedEntity ? 'Edit Entity' : 'Create Entity'}</h3>

        <div className="editor-field">
          <label>Name</label>
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="Entity name"
            disabled={!!selectedEntity}
          />
        </div>

        <div className="editor-field">
          <label>Type</label>
          <input
            type="text"
            value={editType}
            onChange={(e) => setEditType(e.target.value)}
            placeholder="e.g., Person, Concept, Project"
            disabled={!!selectedEntity}
          />
        </div>

        <div className="editor-field">
          <label>Observations</label>
          <div className="observations-list">
            {editObservations.map((obs, index) => (
              <div key={index} className="observation-item">
                <span className="observation-text">{obs}</span>
                <button
                  className="observation-remove"
                  onClick={() => removeObservation(index)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <div className="add-observation">
            <input
              type="text"
              value={newObservation}
              onChange={(e) => setNewObservation(e.target.value)}
              placeholder="Add an observation..."
              onKeyDown={(e) => e.key === 'Enter' && addObservation()}
            />
            <button className="btn-secondary btn-sm" onClick={addObservation}>
              Add
            </button>
          </div>
        </div>

        <div className="editor-actions">
          <button className="btn-secondary" onClick={closeEditor}>Cancel</button>
          <button
            className="btn-primary"
            onClick={saveEntity}
            disabled={!editName.trim() || !editType.trim()}
          >
            {selectedEntity ? 'Save Changes' : 'Create Entity'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="memory-browser">
      <header className="memory-header">
        <div className="header-left">
          <h2>Knowledge Graph</h2>
          <span className="entity-count">{graph.entities.length} entities</span>
        </div>
        <button className="btn-primary btn-sm" onClick={() => openEditor()}>
          + Add Entity
        </button>
      </header>

      <div className="memory-toolbar">
        <input
          type="text"
          placeholder="Search entities..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (!e.target.value) loadGraph();
          }}
          onKeyDown={(e) => e.key === 'Enter' && searchEntities(searchQuery)}
          className="search-input"
        />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="filter-select"
        >
          {entityTypes.map(type => (
            <option key={type} value={type}>
              {type === 'all' ? 'All Types' : type}
            </option>
          ))}
        </select>
        <button className="btn-secondary btn-sm" onClick={() => searchEntities(searchQuery)}>
          Search
        </button>
      </div>

      {filteredEntities.length === 0 ? (
        <div className="memory-empty">
          <span className="empty-icon">🧠</span>
          <p>No entities found</p>
          <button className="btn-primary" onClick={() => openEditor()}>
            Create your first entity
          </button>
        </div>
      ) : (
        <div className="entities-grid">
          {filteredEntities.map(entity => {
            const relations = getRelationsFor(entity.name);
            return (
              <div key={entity.name} className="entity-card">
                <div className="entity-header">
                  <div className="entity-info">
                    <span className="entity-name">{entity.name}</span>
                    <span className="entity-type">{entity.entityType}</span>
                  </div>
                  <div className="entity-actions">
                    <button
                      className="btn-icon"
                      onClick={() => openEditor(entity)}
                      title="Edit"
                    >
                      ✎
                    </button>
                    <button
                      className="btn-icon btn-danger-icon"
                      onClick={() => deleteEntity(entity.name)}
                      title="Delete"
                    >
                      ×
                    </button>
                  </div>
                </div>

                <div className="entity-observations">
                  {entity.observations.slice(0, 3).map((obs, index) => (
                    <div key={index} className="observation">
                      <span className="observation-bullet">•</span>
                      <span>{obs}</span>
                    </div>
                  ))}
                  {entity.observations.length > 3 && (
                    <span className="more-observations">
                      +{entity.observations.length - 3} more
                    </span>
                  )}
                </div>

                {relations.length > 0 && (
                  <div className="entity-relations">
                    {relations.slice(0, 2).map((rel, index) => (
                      <div key={index} className="relation">
                        <span className="relation-arrow">
                          {rel.from === entity.name ? '→' : '←'}
                        </span>
                        <span className="relation-type">{rel.relationType}</span>
                        <span className="relation-target">
                          {rel.from === entity.name ? rel.to : rel.from}
                        </span>
                      </div>
                    ))}
                    {relations.length > 2 && (
                      <span className="more-relations">
                        +{relations.length - 2} more relations
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

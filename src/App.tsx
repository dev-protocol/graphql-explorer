import React, { Component, ReactNode } from 'react'
import GraphiQL from 'graphiql'
import GraphiQLExplorer from 'graphiql-explorer'
import {
	buildClientSchema,
	getIntrospectionQuery,
	parse,
	IntrospectionQuery,
} from 'graphql'

import { makeDefaultArg, getDefaultScalarArgValue } from './CustomArgs'

import 'graphiql/graphiql.css'
import './App.css'

import type { GraphQLSchema } from 'graphql'

async function fetcher(
	params: Record<string, unknown>
): Promise<Record<string, unknown>> {
	return fetch('https://api.devprtcl.com/v1/graphql', {
		method: 'POST',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(params),
	})
		.then(async function (response) {
			return response.text()
		})
		.then(async function (responseBody) {
			try {
				return JSON.parse(responseBody)
			} catch (e) {
				return responseBody
			}
		})
}

const DEFAULT_QUERY = `# shift-option/alt-click on a query below to jump to it in the explorer
# option/alt-click on a field in the explorer to select all subfields
query Properties{
	property_meta(limit: 10) {
		property
		author
		name
		symbol
	}
}
`

type State = {
	schema?: GraphQLSchema
	query: string
	explorerIsOpen: boolean
}

class App extends Component<Record<string, unknown>, State> {
	_graphiql: GraphiQL
	state = { schema: undefined, query: DEFAULT_QUERY, explorerIsOpen: true }

	componentDidMount(): void {
		fetcher({
			query: getIntrospectionQuery(),
		})
			.then((result) => {
				const editor = this._graphiql.getQueryEditor()
				editor.setOption('extraKeys', {
					...(editor.options.extraKeys || {}),
					'Shift-Alt-LeftClick': this._handleInspectOperation,
				})

				this.setState({
					schema: buildClientSchema(result.data as IntrospectionQuery),
				})
			})
			.catch(console.error)
	}

	_handleInspectOperation = (
		cm: any,
		mousePos: { line: number; ch: number }
	): void => {
		const parsedQuery = parse(this.state.query || '')

		if (!parsedQuery) {
			console.error("Couldn't parse query document")
			return
		}

		const token = cm.getTokenAt(mousePos)
		const start = { line: mousePos.line, ch: token.start }
		const end = { line: mousePos.line, ch: token.end }
		const relevantMousePos = {
			start: cm.indexFromPos(start),
			end: cm.indexFromPos(end),
		}

		const position = relevantMousePos

		const def = parsedQuery.definitions.find((definition) => {
			if (!definition.loc) {
				console.log('Missing location information for definition')
				return false
			}

			const { start, end } = definition.loc
			return start <= position.start && end >= position.end
		})

		if (!def) {
			console.error('Unable to find definition corresponding to mouse position')
			return
		}

		const operationKind =
			def.kind === 'OperationDefinition'
				? def.operation
				: def.kind === 'FragmentDefinition'
				? 'fragment'
				: 'unknown'

		const operationName =
			def.kind === 'OperationDefinition' && Boolean(def.name)
				? def.name!.value
				: def.kind === 'FragmentDefinition' && Boolean(def.name)
				? def.name.value
				: 'unknown'

		// eslint-disable-next-line @typescript-eslint/restrict-template-expressions
		const selector = `.graphiql-explorer-root #${operationKind}-${operationName}`

		const el = document.querySelector(selector)
		el?.scrollIntoView()
	}

	_handleEditQuery = (query: string): void => this.setState({ query })

	_handleToggleExplorer = (): void => {
		this.setState({ explorerIsOpen: !this.state.explorerIsOpen })
	}

	render(): ReactNode {
		const { query, schema } = this.state
		return (
			<div className="graphiql-container">
				<GraphiQLExplorer
					schema={schema}
					query={query}
					onEdit={this._handleEditQuery}
					onRunOperation={(operationName): void =>
						this._graphiql.handleRunQuery(operationName)
					}
					explorerIsOpen={this.state.explorerIsOpen}
					onToggleExplorer={this._handleToggleExplorer}
					getDefaultScalarArgValue={getDefaultScalarArgValue}
					makeDefaultArg={makeDefaultArg}
				/>
				<GraphiQL
					ref={(ref: any): void => {
						this._graphiql = ref
					}}
					fetcher={fetcher}
					schema={schema}
					query={query}
					onEditQuery={this._handleEditQuery}
				>
					<GraphiQL.Toolbar>
						<GraphiQL.Button
							onClick={(): void => this._graphiql.handlePrettifyQuery()}
							label="Prettify"
							title="Prettify Query (Shift-Ctrl-P)"
						/>
						<GraphiQL.Button
							onClick={(): void => this._graphiql.handleToggleHistory()}
							label="History"
							title="Show History"
						/>
						<GraphiQL.Button
							onClick={this._handleToggleExplorer}
							label="Explorer"
							title="Toggle Explorer"
						/>
					</GraphiQL.Toolbar>
				</GraphiQL>
			</div>
		)
	}
}

export default App

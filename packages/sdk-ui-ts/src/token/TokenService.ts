import { Network } from '@injectivelabs/networks'
import { ChainId, Coin } from '@injectivelabs/ts-types'
import {
  DenomClientAsync,
  ContractAccountBalance,
  ExplorerCW20BalanceWithToken,
} from '@injectivelabs/sdk-ts'
import {
  BankBalances,
  CoinWithLabel,
  UiBaseSpotMarket,
  UiSubaccountBalance,
  UiBasePerpetualMarket,
  UiBaseSpotMarketWithToken,
  UiBaseBinaryOptionsMarket,
  UiBaseExpiryFuturesMarket,
  PerpetualMarketWithTokenAndSlug,
  BinaryOptionsMarketWithTokenAndSlug,
  ExpiryFuturesMarketWithTokenAndSlug,
} from '../client/types'
import {
  UiBridgeTransaction,
  BankBalanceWithToken,
  Cw20BalanceWithToken,
  SubaccountBalanceWithToken,
  UiBridgeTransactionWithToken,
  ContractAccountBalanceWithToken,
} from '../types'
import { Token, TokenInfo } from '@injectivelabs/token-metadata'
import { awaitForAll } from '@injectivelabs/utils'

/**
 * With the TokenService class we can convert objects
 * with denoms to append token metadata information
 */
export class TokenService {
  public network: Network

  public chainId: ChainId

  public denomClient: DenomClientAsync

  constructor({ chainId, network }: { chainId: ChainId; network: Network }) {
    this.network = network
    this.chainId = chainId
    this.denomClient = new DenomClientAsync(network)
  }

  async toCoinsWithToken(supply: Coin[]): Promise<TokenInfo[]> {
    const tokens = await awaitForAll(supply, (coin) =>
      this.denomClient.getDenomToken(coin.denom),
    )

    return tokens.filter((token) => token) as TokenInfo[]
  }

  async toSupplyWithToken(supply: Coin[]): Promise<TokenInfo[]> {
    return this.toCoinsWithToken(supply)
  }

  async toSupplyWithTokenAndLabel(supply: Coin[]): Promise<{
    bankSupply: CoinWithLabel[]
    ibcBankSupply: CoinWithLabel[]
  }> {
    const supplyWithToken = await this.toSupplyWithToken(supply)
    const supplyWithLabel = supplyWithToken.map((token, index) => {
      const coin = supply[index]

      return {
        ...coin,
        code: coin.denom,
        label: token ? token.symbol : coin.denom,
      }
    })

    return {
      bankSupply: supplyWithLabel.filter(
        (supply) => !supply.denom.startsWith('ibc/'),
      ),
      ibcBankSupply: supplyWithLabel.filter(
        (supply) => !supply.denom.startsWith('ibc/'),
      ),
    }
  }

  async toBalancesWithToken(
    balances: BankBalances,
    ibcBalances: BankBalances,
  ): Promise<{
    bankBalancesWithToken: BankBalanceWithToken[]
    ibcBankBalancesWithToken: BankBalanceWithToken[]
  }> {
    const bankBalancesWithToken = (
      await awaitForAll(Object.keys(balances), async (denom) => ({
        denom,
        balance: balances[denom],
        token: await this.denomClient.getDenomToken(denom),
      }))
    ).filter((balance) => balance.token !== undefined) as BankBalanceWithToken[]

    const ibcBankBalancesWithToken = (
      await awaitForAll(Object.keys(ibcBalances), async (denom) => {
        return {
          denom,
          balance: ibcBalances[denom],
          token: await this.denomClient.getDenomToken(denom),
        }
      })
    ).filter((balance) => balance.token !== undefined) as BankBalanceWithToken[]

    return {
      bankBalancesWithToken,
      ibcBankBalancesWithToken,
    }
  }

  async toCw20BalancesWithToken(
    cw20Balances: ExplorerCW20BalanceWithToken[],
  ): Promise<Cw20BalanceWithToken[]> {
    const balancesWithToken = await awaitForAll(
      cw20Balances,
      async (balance) => {
        const token = await this.denomClient.getDenomToken(
          balance.contractAddress,
        )

        if (!token) {
          return
        }

        return {
          ...balance,
          token,
          denom: token.symbol,
          contractDetails: {
            address: balance.contractAddress,
          },
        }
      },
    )

    return balancesWithToken.filter(
      (balance) => balance,
    ) as Cw20BalanceWithToken[]
  }

  async toContractCw20BalancesWithToken({
    contractAddress,
    contractAccountsBalance,
  }: {
    contractAddress: string
    contractAccountsBalance: ContractAccountBalance[]
  }): Promise<ContractAccountBalanceWithToken[]> {
    const token = await this.denomClient.getDenomToken(contractAddress)
    const balances = contractAccountsBalance.map((balance) => {
      if (!token) {
        return
      }

      return {
        ...balance,
        token,
      }
    })

    return balances.filter(
      (balance) => balance,
    ) as ContractAccountBalanceWithToken[]
  }

  async toSubaccountBalanceWithToken(
    balance: UiSubaccountBalance,
  ): Promise<SubaccountBalanceWithToken> {
    return {
      token: (await this.denomClient.getDenomToken(balance.denom)) as Token,
      denom: balance.denom,
      availableBalance: balance.availableBalance,
      totalBalance: balance.totalBalance,
    }
  }

  async toSubaccountBalancesWithToken(
    balances: UiSubaccountBalance[],
  ): Promise<SubaccountBalanceWithToken[]> {
    return (
      await awaitForAll(balances, this.toSubaccountBalanceWithToken.bind(this))
    ).filter(
      (balance) => balance.token !== undefined,
    ) as SubaccountBalanceWithToken[]
  }

  async toSpotMarketWithToken(
    market: UiBaseSpotMarket,
  ): Promise<UiBaseSpotMarketWithToken> {
    const baseToken = await this.denomClient.getDenomToken(market.baseDenom)
    const quoteToken = await this.denomClient.getDenomToken(market.quoteDenom)
    const slug =
      baseToken && quoteToken
        ? `${baseToken.symbol.toLowerCase()}-${quoteToken.symbol.toLowerCase()}`
        : market.ticker.replace('/', '-').replace(' ', '-').toLowerCase()

    return {
      ...market,
      slug,
      baseToken,
      quoteToken,
    } as UiBaseSpotMarketWithToken
  }

  async toSpotMarketsWithToken(
    markets: UiBaseSpotMarket[],
  ): Promise<UiBaseSpotMarketWithToken[]> {
    return (
      await awaitForAll(markets, this.toSpotMarketWithToken.bind(this))
    ).filter(
      (market) =>
        market.baseToken !== undefined && market.quoteToken !== undefined,
    ) as UiBaseSpotMarketWithToken[]
  }

  async toDerivativeMarketWithToken<
    T extends UiBasePerpetualMarket | UiBaseExpiryFuturesMarket,
    R extends
      | PerpetualMarketWithTokenAndSlug
      | ExpiryFuturesMarketWithTokenAndSlug,
  >(market: T): Promise<R> {
    const slug = market.ticker
      .replaceAll('/', '-')
      .replaceAll(' ', '-')
      .toLowerCase()
    const [baseTokenSymbol] = slug.split('-')
    const baseToken = await this.denomClient.getDenomToken(baseTokenSymbol)
    const quoteToken = await this.denomClient.getDenomToken(market.quoteDenom)

    return {
      ...market,
      slug,
      baseToken,
      quoteToken,
    } as unknown as R
  }

  async toDerivativeMarketsWithToken(
    markets: Array<UiBasePerpetualMarket | UiBaseExpiryFuturesMarket>,
  ): Promise<
    Array<PerpetualMarketWithTokenAndSlug | ExpiryFuturesMarketWithTokenAndSlug>
  > {
    return (
      await awaitForAll(markets, this.toDerivativeMarketWithToken.bind(this))
    ).filter(
      (market) =>
        market.baseToken !== undefined && market.quoteToken !== undefined,
    ) as Array<
      PerpetualMarketWithTokenAndSlug | ExpiryFuturesMarketWithTokenAndSlug
    >
  }

  async toBinaryOptionsMarketWithToken(
    market: UiBaseBinaryOptionsMarket,
  ): Promise<BinaryOptionsMarketWithTokenAndSlug> {
    const quoteToken = await this.denomClient.getDenomToken(market.quoteDenom)
    const slug = market.ticker
      .replaceAll('/', '-')
      .replaceAll(' ', '-')
      .toLowerCase()
    const [baseTokenSymbol] = quoteToken
      ? market.ticker.replace(quoteToken.symbol, '')
      : market.ticker.replace('/', '')
    const baseToken = {
      denom: slug,
      logo: 'injective-v3.svg',
      icon: 'injective-v3.svg',
      symbol: baseTokenSymbol,
      name: baseTokenSymbol,
      decimals: 18,
      coinGeckoId: '',
    } as Token

    return {
      ...market,
      slug,
      baseToken,
      quoteToken,
    } as BinaryOptionsMarketWithTokenAndSlug
  }

  async toBinaryOptionsMarketsWithToken(
    markets: UiBaseBinaryOptionsMarket[],
  ): Promise<BinaryOptionsMarketWithTokenAndSlug[]> {
    return (
      await awaitForAll(markets, this.toBinaryOptionsMarketWithToken.bind(this))
    ).filter(
      (market) =>
        market.baseToken !== undefined && market.quoteToken !== undefined,
    ) as BinaryOptionsMarketWithTokenAndSlug[]
  }

  async toBridgeTransactionWithToken(
    transaction: UiBridgeTransaction,
  ): Promise<UiBridgeTransactionWithToken> {
    const transactionExists =
      transaction && transaction.denom && Object.keys(transaction).length > 0

    if (!transactionExists) {
      return {} as UiBridgeTransactionWithToken
    }

    // Edge case for transferring INJ from IBC chains to Injective chain [osmosis]
    if (
      transaction.denom.startsWith('transfer') &&
      transaction.denom.endsWith('inj')
    ) {
      return {
        ...transaction,
        token: (await this.denomClient.getDenomToken('INJ'))!,
      }
    }

    const tokenFromDenomAsSymbol = (await this.denomClient.getDenomToken(
      transaction.denom,
    )) as Token

    if (tokenFromDenomAsSymbol) {
      return {
        ...transaction,
        token: tokenFromDenomAsSymbol || {},
      }
    }

    return {
      ...transaction,
      token: (await this.denomClient.getDenomToken('INJ'))!,
    }
  }

  async toBridgeTransactionsWithToken(
    transactions: UiBridgeTransaction[],
  ): Promise<UiBridgeTransactionWithToken[]> {
    return (
      await awaitForAll(
        transactions,
        this.toBridgeTransactionWithToken.bind(this),
      )
    ).filter(
      (transaction) => transaction && transaction.token !== undefined,
    ) as UiBridgeTransactionWithToken[]
  }
}

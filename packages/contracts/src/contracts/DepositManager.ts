import { DepositManager } from '@injectivelabs/web3-contract-typings/types/DepositManager'
import { ContractException } from '@injectivelabs/exceptions'
import { BigNumberInWei } from '@injectivelabs/utils'
import {
  AccountAddress,
  ChainId,
  TransactionOptions,
} from '@injectivelabs/ts-types'
import { Web3Strategy } from '@injectivelabs/web3-strategy'
import { getTransactionOptionsAsNonPayableTx } from '@injectivelabs/tx-utils'
import abi from './abi/deposit_manager'
import { ContractTxFunctionObj } from '../types'
import BaseContract from '../BaseContract'

export class DepositManagerContract extends BaseContract<
  DepositManager,
  keyof DepositManager['events']
> {
  static contractName = 'DepositManager'

  constructor({
    chainId,
    address,
    web3Strategy,
  }: {
    chainId: ChainId
    address: string
    web3Strategy: Web3Strategy
  }) {
    super({
      abi,
      chainId,
      address,
      web3Strategy,
    })
  }

  public deposit({
    amount,
    transactionOptions,
  }: {
    address: AccountAddress
    amount: BigNumberInWei
    transactionOptions: TransactionOptions
  }): ContractTxFunctionObj<string> {
    const { contract } = this

    return {
      callAsync() {
        throw new ContractException(
          'You cannot call this contract method as a call',
        )
      },

      getABIEncodedTransactionData(): string {
        return contract.methods.deposit(amount.toFixed()).encodeABI()
      },

      async sendTransactionAsync(): Promise<string> {
        const { transactionHash } = await contract.methods
          .deposit(amount.toFixed())
          .send(getTransactionOptionsAsNonPayableTx(transactionOptions))

        return transactionHash
      },

      async estimateGasAsync(): Promise<number> {
        return contract.methods
          .deposit(amount.toFixed())
          .estimateGas(transactionOptions)
      },
    }
  }
}

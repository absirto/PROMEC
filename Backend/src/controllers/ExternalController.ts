import { Request, Response } from 'express';
import axios from 'axios';
import { logger } from '../utils/logger';

export const ExternalController = {
  async lookupCNPJ(req: Request, res: Response) {
    const { cnpj } = req.params;
    const cnpjValue = Array.isArray(cnpj) ? cnpj[0] : cnpj;
    const cleanCnpj = String(cnpjValue || '').replace(/\D/g, '');

    if (cleanCnpj.length !== 14) {
      return res.status(400).json({ error: 'CNPJ inválido' });
    }

    try {
      logger.info(`Buscando CNPJ: ${cleanCnpj} via BrasilAPI`);
      const response = await axios.get(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
      
      const data = response.data;
      
      // Mapeamento simplificado para o frontend
      const result = {
        corporateName: data.razao_social,
        tradeName: data.nome_fantasia || data.razao_social,
        cnpj: data.cnpj,
        address: {
          zipCode: data.cep,
          street: data.logradouro,
          number: data.numero,
          complement: data.complemento,
          neighborhood: data.bairro,
          city: data.municipio,
          state: data.uf,
        },
        contact: {
          email: data.email,
          phone: data.ddd_telefone_1 || data.ddd_telefone_2,
        }
      };

      res.json(result);
    } catch (error: any) {
      logger.error(`Erro ao buscar CNPJ ${cleanCnpj}: ${error.message}`);
      if (error.response?.status === 404) {
        return res.status(404).json({ error: 'CNPJ não encontrado' });
      }
      res.status(500).json({ error: 'Erro ao consultar Receita Federal' });
    }
  }
};

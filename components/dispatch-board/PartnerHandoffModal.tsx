"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Divider,
  Flex,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Tag,
  Typography,
} from "antd";
import { BankOutlined, PlusOutlined } from "@ant-design/icons";
import { message } from "@/lib/antd-message";
import { api, getErrorMessage } from "@/lib/api";
import type {
  BoardItem,
  PartnerAgency,
  PartnerMoneyFlow,
} from "./types";

const { Text } = Typography;

export function PartnerHandoffModal({
  assignment,
  open,
  onClose,
  onDone,
}: {
  assignment: BoardItem | null;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [partners, setPartners] = useState<PartnerAgency[]>([]);
  const [partnerId, setPartnerId] = useState<string | undefined>();
  const [newPartner, setNewPartner] = useState(false);
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [contractRef, setContractRef] = useState("");
  const [amount, setAmount] = useState<number | null>(
    assignment?.partnerAmount ? Number(assignment.partnerAmount) : null,
  );
  const [currency, setCurrency] = useState(
    assignment?.partnerCurrency ?? "VND",
  );
  const [moneyFlow, setMoneyFlow] = useState<PartnerMoneyFlow>(
    assignment?.partnerMoneyFlow ?? "PARTNER_COLLECTS_AND_REMITS",
  );
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    api
      .get("/partners")
      .then((r) => setPartners(r.data ?? []))
      .catch((e) => message.error(getErrorMessage(e, "Could not load partners")));
  }, [open]);

  const save = async () => {
    if (!assignment) return;
    if (!partnerId && !name.trim()) {
      message.warning("Choose a partner agency or enter a new one");
      return;
    }
    if (!amount || amount <= 0) {
      message.warning("Enter the agreed partner amount");
      return;
    }
    setSaving(true);
    try {
      let selectedId = partnerId;
      if (!selectedId) {
        const { data } = await api.post("/partners", {
          name: name.trim(),
          contactName: contactName.trim() || undefined,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
        });
        selectedId = data.id;
      }
      await api.post(`/assignments/${assignment.id}/partner-confirm`, {
        partnerId: selectedId,
        contractRef: contractRef.trim() || undefined,
        amount,
        currency,
        moneyFlow,
        note: note.trim() || undefined,
      });
      message.success("Trip handed to the partner and sent to Accounting");
      onDone();
    } catch (e) {
      message.error(getErrorMessage(e, "Could not confirm the partner handoff"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title="Outsource this bus to a partner agency"
      width={640}
      okText="Confirm & send to Accounting"
      cancelText="Cancel"
      confirmLoading={saving}
      onOk={save}
    >
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        message="The bus will be blocked for our crew and dispatch board."
        description="Confirming sends the partner trip straight to the Accounting Room. Use Return if the partner cannot run the trip."
      />

      <Text strong style={{ display: "block", marginBottom: 8 }}>
        Partner agency
      </Text>
      <Space wrap style={{ marginBottom: 12 }}>
        <Button
          size="small"
          type={!newPartner ? "primary" : "default"}
          onClick={() => setNewPartner(false)}
        >
          Existing partner
        </Button>
        <Button
          size="small"
          type={newPartner ? "primary" : "default"}
          icon={<PlusOutlined />}
          onClick={() => {
            setNewPartner(true);
            setPartnerId(undefined);
          }}
        >
          New partner
        </Button>
      </Space>

      {newPartner ? (
        <Flex vertical gap={8}>
          <Input
            placeholder="Agency name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Flex gap={8} wrap>
            <Input
              placeholder="Contact name"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              style={{ flex: 1, minWidth: 180 }}
            />
            <Input
              placeholder="Phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={{ flex: 1, minWidth: 180 }}
            />
          </Flex>
          <Input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Flex>
      ) : (
        <Select
          showSearch
          allowClear
          optionFilterProp="label"
          placeholder="Select a partner agency"
          value={partnerId}
          onChange={setPartnerId}
          style={{ width: "100%" }}
          options={partners.map((p) => ({
            value: p.id,
            label: `${p.name}${p.phone ? ` · ${p.phone}` : ""}`,
          }))}
          notFoundContent={
            <Text type="secondary">No partner yet — create one above.</Text>
          }
        />
      )}

      <Divider style={{ margin: "18px 0" }} />

      <Flex gap={12} wrap>
        <div style={{ flex: 1, minWidth: 180 }}>
          <Text strong style={{ display: "block", marginBottom: 6 }}>
            Contract / reference
          </Text>
          <Input
            value={contractRef}
            onChange={(e) => setContractRef(e.target.value)}
            placeholder="Optional"
          />
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <Text strong style={{ display: "block", marginBottom: 6 }}>
            Agreed amount *
          </Text>
          <InputNumber
            value={amount}
            onChange={(v) => setAmount(v ?? null)}
            min={0}
            style={{ width: "100%" }}
            formatter={(v) => (v == null ? "" : `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ","))}
            parser={(v) => Number((v ?? "").replace(/,/g, ""))}
          />
        </div>
        <div style={{ width: 100 }}>
          <Text strong style={{ display: "block", marginBottom: 6 }}>
            Currency
          </Text>
          <Select
            value={currency}
            onChange={setCurrency}
            options={[{ value: "VND" }, { value: "USD" }]}
            style={{ width: "100%" }}
          />
        </div>
      </Flex>

      <Text strong style={{ display: "block", margin: "16px 0 6px" }}>
        Money movement
      </Text>
      <Select
        value={moneyFlow}
        onChange={setMoneyFlow}
        style={{ width: "100%" }}
        options={[
          {
            value: "PARTNER_COLLECTS_AND_REMITS",
            label: "Partner collects from customers and remits to us",
          },
          {
            value: "COMPANY_PAYS_PARTNER",
            label: "We pay the partner agency",
          },
        ]}
      />

      <Text strong style={{ display: "block", margin: "16px 0 6px" }}>
        Note
      </Text>
      <Input.TextArea
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Pickup/meeting instructions or partner notes (optional)"
      />

      <div style={{ marginTop: 12 }}>
        <Tag icon={<BankOutlined />} color="purple">
          OUTSOURCED · NOT PAID
        </Tag>
        <Text type="secondary" style={{ fontSize: 12 }}>
          The partner trip appears in Accounting as a separate queue source.
        </Text>
      </div>
    </Modal>
  );
}

export function PartnerReturnModal({
  assignment,
  open,
  onClose,
  onDone,
}: {
  assignment: BoardItem | null;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!assignment) return;
    if (reason.trim().length < 5) {
      message.warning("Enter a return reason (at least 5 characters)");
      return;
    }
    setSaving(true);
    try {
      await api.post(`/assignments/${assignment.id}/partner-return`, {
        reason: reason.trim(),
      });
      message.success("Partner trip returned — assign crew and run it again");
      onDone();
    } catch (e) {
      message.error(getErrorMessage(e, "Could not return the partner trip"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={`Return partner trip "${assignment?.code ?? ""}"?`}
      okText="Return & reopen"
      cancelText="Cancel"
      okButtonProps={{ danger: true }}
      confirmLoading={saving}
      onOk={save}
    >
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 12 }}
        message="This removes the partner entry from the Accounting queue."
        description="The trip goes back to Pending so you can assign our crew or choose another partner."
      />
      <Input.TextArea
        rows={3}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (required) — e.g. partner has no vehicle"
      />
    </Modal>
  );
}
